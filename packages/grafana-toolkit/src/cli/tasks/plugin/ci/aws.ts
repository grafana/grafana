import AWS from 'aws-sdk';

import defaults from 'lodash/defaults';
import clone from 'lodash/clone';

export function getS3(configUpdate?: {}) {
  if (configUpdate) {
    AWS.config.update(configUpdate);
  }

  // const sts = new AWS.STS({apiVersion: '2011-06-15'});
  // sts.getCallerIdentity({}, function(err, data) {
  //   console.log( 'STS!!!');
  //   if (err) console.log(err, 'ERROR'); // an error occurred
  //   else     console.log(data);         // successful response
  // });

  return new AWS.S3({ apiVersion: '2006-03-01' });
}

export async function readJSONIfExists<T>(s3: AWS.S3, req: AWS.S3.Types.GetObjectRequest, defaultValue: T): Promise<T> {
  return new Promise((resolve, reject) => {
    s3.getObject(req, (err, data) => {
      if (err) {
        resolve(clone(defaultValue));
      } else {
        console.log('GOT:', data);
        try {
          const v = JSON.parse(data.Body as string);
          resolve(defaults(v, defaultValue));
        } catch (e) {
          console.log('ERROR', e);
          reject('Error reading response');
        }
      }
    });
  });
}

export async function writeJSONToS3(
  s3: AWS.S3,
  obj: Object,
  req: AWS.S3.Types.PutObjectRequest
): Promise<AWS.S3.Types.PutObjectOutput> {
  return new Promise((resolve, reject) => {
    s3.putObject(
      {
        ...req,
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
