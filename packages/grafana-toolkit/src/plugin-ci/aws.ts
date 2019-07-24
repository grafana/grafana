import AWS from 'aws-sdk';
import path from 'path';
import fs from 'fs';

import { PluginPackageDetails, ZipFileInfo } from './types';
import defaults from 'lodash/defaults';
import clone from 'lodash/clone';

interface UploadArgs {
  local: string;
  remote: string;
}

export class S3Client {
  readonly bucket: string;
  readonly prefix: string;
  readonly s3: AWS.S3;

  constructor(bucket?: string) {
    this.bucket = bucket || 'grafana-experiments';
    this.prefix = 'plugins/';

    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    this.s3.headBucket({ Bucket: this.bucket }, (err, data) => {
      if (err) {
        throw new Error('Unable to read: ' + this.bucket);
      } else {
        console.log('s3: ' + data);
      }
    });
  }

  async uploadPackages(packageInfo: PluginPackageDetails, folder: UploadArgs) {
    await this.uploadPackage(packageInfo.plugin, folder);
    if (packageInfo.docs) {
      await this.uploadPackage(packageInfo.docs, folder);
    }
  }

  async uploadPackage(file: ZipFileInfo, folder: UploadArgs): Promise<string> {
    const fpath = path.resolve(process.cwd(), folder.local, file.name);
    if (!fs.existsSync(fpath)) {
      return Promise.reject('File not found: ' + fpath);
    }
    console.log('Uploading: ' + fpath);
    const stream = fs.createReadStream(fpath);
    return new Promise((resolve, reject) => {
      this.s3.putObject(
        {
          Key: this.prefix + folder.remote + '/' + file.name,
          Bucket: this.bucket,
          Body: stream,
          ContentType: getContentTypeForFile(file.name),
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            if (file.md5 && file.md5 !== data.ETag) {
              reject('Upload ETag does not match MD5');
            } else {
              resolve(data.ETag);
            }
          }
        }
      );
    });
  }

  async exits(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.s3.getObject(
        {
          Bucket: this.bucket,
          Key: this.prefix + key,
        },
        (err, data) => {
          if (err) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  async readJSON<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve, reject) => {
      this.s3.getObject(
        {
          Bucket: this.bucket,
          Key: this.prefix + key,
        },
        (err, data) => {
          if (err) {
            resolve(clone(defaultValue));
          } else {
            try {
              const v = JSON.parse(data.Body as string);
              resolve(defaults(v, defaultValue));
            } catch (e) {
              console.log('ERROR', e);
              reject('Error reading response');
            }
          }
        }
      );
    });
  }

  async writeJSON(
    key: string,
    obj: {},
    params?: Partial<AWS.S3.Types.PutObjectRequest>
  ): Promise<AWS.S3.Types.PutObjectOutput> {
    return new Promise((resolve, reject) => {
      this.s3.putObject(
        {
          ...params,
          Key: this.prefix + key,
          Bucket: this.bucket,
          Body: JSON.stringify(obj, null, 2), // Pretty print
          ContentType: 'application/json',
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }
}

function getContentTypeForFile(name: string): string | undefined {
  const idx = name.lastIndexOf('.');
  if (idx > 0) {
    const ext = name.substring(idx + 1).toLowerCase();
    if (ext === 'zip') {
      return 'application/zip';
    }
    if (ext === 'json') {
      return 'application/json';
    }
  }
  return undefined;
}
