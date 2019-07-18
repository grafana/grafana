import AWS from 'aws-sdk';

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
