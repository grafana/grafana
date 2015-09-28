// define([
//   './helpers',
//   'app/plugins/datasource/cloudwatch/datasource',
//   'aws-sdk',
// ], function(helpers) {
//   'use strict';
//
//   describe('CloudWatchDatasource', function() {
//     var ctx = new helpers.ServiceTestContext();
//
//     beforeEach(module('grafana.services'));
//     beforeEach(module('grafana.controllers'));
//     beforeEach(ctx.providePhase(['templateSrv']));
//     beforeEach(ctx.createService('CloudWatchDatasource'));
//     beforeEach(function() {
//       ctx.ds = new ctx.service({
//         jsonData: {
//           defaultRegion: 'us-east-1',
//           access: 'proxy'
//         }
//       });
//     });
//
//     describe('When performing CloudWatch query', function() {
//       var requestParams;
//
//       var query = {
//         range: { from: 'now-1h', to: 'now' },
//         targets: [
//           {
//             region: 'us-east-1',
//             namespace: 'AWS/EC2',
//             metricName: 'CPUUtilization',
//             dimensions: {
//               InstanceId: 'i-12345678'
//             },
//             statistics: {
//               Average: true
//             },
//             period: 300
//           }
//         ]
//       };
//
//       var response = {
//         Datapoints: [
//           {
//             Average: 1,
//             Timestamp: 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'
//           }
//         ],
//         Label: 'CPUUtilization'
//       };
//
//       beforeEach(function() {
//         ctx.ds.getCloudWatchClient = function() {
//           return {
//             getMetricStatistics: function(params, callback) {
//               setTimeout(function() {
//                 requestParams = params;
//                 callback(null, response);
//               }, 0);
//             }
//           };
//         };
//       });
//
//       it('should generate the correct query', function() {
//         ctx.ds.query(query).then(function() {
//           expect(requestParams.Namespace).to.be(query.targets[0].namespace);
//           expect(requestParams.MetricName).to.be(query.targets[0].metricName);
//           expect(requestParams.Dimensions[0].Name).to.be(Object.keys(query.targets[0].dimensions)[0]);
//           expect(requestParams.Dimensions[0].Value).to.be(query.targets[0].dimensions[Object.keys(query.targets[0].dimensions)[0]]);
//           expect(requestParams.Statistics).to.eql(Object.keys(query.targets[0].statistics));
//           expect(requestParams.Period).to.be(query.targets[0].period);
//         });
//       });
//
//       it('should return series list', function() {
//         ctx.ds.query(query).then(function(result) {
//           var s = Object.keys(query.targets[0].statistics)[0];
//           expect(result.data[0].target).to.be(response.Label + s);
//           expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0][s]);
//         });
//       });
//     });
//
//     describe('When performing CloudWatch metricFindQuery', function() {
//       var requestParams;
//
//       var response = {
//         Metrics: [
//           {
//             Namespace: 'AWS/EC2',
//             MetricName: 'CPUUtilization',
//             Dimensions: [
//               {
//                 Name: 'InstanceId',
//                 Value: 'i-12345678'
//               }
//             ]
//           }
//         ]
//       };
//
//       beforeEach(function() {
//         ctx.ds.getCloudWatchClient = function() {
//           return {
//             listMetrics: function(params, callback) {
//               setTimeout(function() {
//                 requestParams = params;
//                 callback(null, response);
//               }, 0);
//             }
//           };
//         };
//       });
//
//       it('should return suggest list for region()', function() {
//         var query = 'region()';
//         ctx.ds.metricFindQuery(query).then(function(result) {
//           expect(result).to.contain('us-east-1');
//         });
//       });
//
//       it('should return suggest list for namespace()', function() {
//         var query = 'namespace()';
//         ctx.ds.metricFindQuery(query).then(function(result) {
//           expect(result).to.contain('AWS/EC2');
//         });
//       });
//
//       it('should return suggest list for metrics()', function() {
//         var query = 'metrics(AWS/EC2)';
//         ctx.ds.metricFindQuery(query).then(function(result) {
//           expect(result).to.contain('CPUUtilization');
//         });
//       });
//
//       it('should return suggest list for dimension_keys()', function() {
//         var query = 'dimension_keys(AWS/EC2)';
//         ctx.ds.metricFindQuery(query).then(function(result) {
//           expect(result).to.contain('InstanceId');
//         });
//       });
//
//       it('should return suggest list for dimension_values()', function() {
//         var query = 'dimension_values(us-east-1,AWS/EC2,CPUUtilization)';
//         ctx.ds.metricFindQuery(query).then(function(result) {
//           expect(result).to.contain('InstanceId');
//         });
//       });
//     });
//   });
// });
