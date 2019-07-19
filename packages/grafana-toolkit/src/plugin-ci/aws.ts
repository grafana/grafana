import AWS from 'aws-sdk';

import defaults from 'lodash/defaults';
import clone from 'lodash/clone';

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
      }
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
