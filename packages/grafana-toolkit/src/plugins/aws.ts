import AWS from 'aws-sdk';
import path from 'path';
import fs from 'fs';

import { PluginPackageDetails, ZipFileInfo, TestResultsInfo } from './types';
import defaults from 'lodash/defaults';
import clone from 'lodash/clone';
import { PluginMetaInfo } from '@grafana/ui';

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

  private async uploadPackage(file: ZipFileInfo, folder: UploadArgs): Promise<string> {
    const fpath = path.resolve(process.cwd(), folder.local, file.name);
    return await this.uploadFile(fpath, folder.remote + '/' + file.name, file.md5);
  }

  async uploadPackages(packageInfo: PluginPackageDetails, folder: UploadArgs) {
    await this.uploadPackage(packageInfo.plugin, folder);
    if (packageInfo.docs) {
      await this.uploadPackage(packageInfo.docs, folder);
    }
  }

  async uploadTestFiles(tests: TestResultsInfo[], folder: UploadArgs) {
    for (const test of tests) {
      for (const s of test.screenshots) {
        const img = path.resolve(folder.local, 'jobs', test.job, s);
        await this.uploadFile(img, folder.remote + `/jobs/${test.job}/${s}`);
      }
    }
  }

  async uploadLogo(meta: PluginMetaInfo, folder: UploadArgs): Promise<string | undefined> {
    const { logos } = meta;
    if (logos && logos.large) {
      const img = folder.local + '/' + logos.large;
      const idx = img.lastIndexOf('.');
      const name = 'logo' + img.substring(idx);
      const key = folder.remote + '/' + name;
      await this.uploadFile(img, key);
      return name;
    }
    return undefined;
  }

  async uploadFile(fpath: string, path: string, md5?: string): Promise<string> {
    if (!fs.existsSync(fpath)) {
      return Promise.reject('File not found: ' + fpath);
    }
    console.log('Uploading: ' + fpath);
    const stream = fs.createReadStream(fpath);
    return new Promise((resolve, reject) => {
      this.s3.putObject(
        {
          Key: this.prefix + path,
          Bucket: this.bucket,
          Body: stream,
          ContentType: getContentTypeForFile(path),
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            if (md5 && md5 !== data.ETag && `"${md5}"` !== data.ETag) {
              reject(`Upload ETag does not match MD5 (${md5} !== ${data.ETag})`);
            } else {
              resolve(data.ETag);
            }
          }
        }
      );
    });
  }

  async exists(key: string): Promise<boolean> {
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
    if (ext === 'svg') {
      return 'image/svg+xml';
    }
    if (ext === 'png') {
      return 'image/png';
    }
  }
  return undefined;
}
