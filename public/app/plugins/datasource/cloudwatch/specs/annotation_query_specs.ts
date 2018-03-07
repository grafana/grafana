import "../datasource";
import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import {CloudWatchDatasource} from "../datasource";
import CloudWatchAnnotationQuery from '../annotation_query';

describe('CloudWatchAnnotationQuery', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {
    jsonData: {defaultRegion: 'us-east-1', access: 'proxy'},
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));

  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.ds = $injector.instantiate(CloudWatchDatasource, {instanceSettings: instanceSettings});
  }));

  describe('When performing annotationQuery', function() {
    var parameter = {
      annotation: {
        region: 'us-east-1',
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensions: {
          InstanceId: 'i-12345678'
        },
        statistics: ['Average'],
        period: 300
      },
      range: {
        from: moment(1443438674760),
        to: moment(1443460274760)
      }
    };
    var alarmResponse = {
      MetricAlarms: [
        {
          AlarmName: 'test_alarm_name'
        }
      ]
    };
    var historyResponse = {
      AlarmHistoryItems: [
        {
          Timestamp: '2015-01-01T00:00:00.000Z',
          HistoryItemType: 'StateUpdate',
          AlarmName: 'test_alarm_name',
          HistoryData: '{}',
          HistorySummary: 'test_history_summary'
        }
      ]
    };
    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(params) {
        switch (params.data.action) {
        case 'DescribeAlarmsForMetric':
          return ctx.$q.when({data: alarmResponse});
        case 'DescribeAlarmHistory':
          return ctx.$q.when({data: historyResponse});
        }
      };
    });
    it('should return annotation list', function(done) {
      var annotationQuery = new CloudWatchAnnotationQuery(ctx.ds, parameter.annotation, ctx.$q, ctx.templateSrv);
      annotationQuery.process(parameter.range.from, parameter.range.to).then(function(result) {
        expect(result[0].title).to.be('test_alarm_name');
        expect(result[0].text).to.be('test_history_summary');
        done();
      });
      ctx.$rootScope.$apply();
    });
  });
});
