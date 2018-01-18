import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import { MysqlDatasource } from '../datasource';
import { CustomVariable } from 'app/features/templating/custom_variable';

describe('MySQLDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = { name: 'mysql' };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['backendSrv']));

  beforeEach(
    angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
      ctx.$q = $q;
      ctx.$httpBackend = $httpBackend;
      ctx.$rootScope = $rootScope;
      ctx.ds = $injector.instantiate(MysqlDatasource, {
        instanceSettings: instanceSettings,
      });
      $httpBackend.when('GET', /\.html$/).respond('');
    })
  );

  describe('When performing annotationQuery', function() {
    let results;

    const annotationName = 'MyAnno';

    const options = {
      annotation: {
        name: annotationName,
        rawQuery: 'select time_sec, text, tags from table;',
      },
      range: {
        from: moment(1432288354),
        to: moment(1432288401),
      },
    };

    const response = {
      results: {
        MyAnno: {
          refId: annotationName,
          tables: [
            {
              columns: [{ text: 'time_sec' }, { text: 'text' }, { text: 'tags' }],
              rows: [
                [1432288355, 'some text', 'TagA,TagB'],
                [1432288390, 'some text2', ' TagB , TagC'],
                [1432288400, 'some text3'],
              ],
            },
          ],
        },
      },
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        return ctx.$q.when({ data: response, status: 200 });
      };
      ctx.ds.annotationQuery(options).then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
    });

    it('should return annotation list', function() {
      expect(results.length).to.be(3);

      expect(results[0].text).to.be('some text');
      expect(results[0].tags[0]).to.be('TagA');
      expect(results[0].tags[1]).to.be('TagB');

      expect(results[1].tags[0]).to.be('TagB');
      expect(results[1].tags[1]).to.be('TagC');

      expect(results[2].tags.length).to.be(0);
    });
  });

  describe('When performing metricFindQuery', function() {
    let results;
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          meta: {
            rowCount: 3,
          },
          refId: 'tempvar',
          tables: [
            {
              columns: [{ text: 'title' }, { text: 'text' }],
              rows: [['aTitle', 'some text'], ['aTitle2', 'some text2'], ['aTitle3', 'some text3']],
            },
          ],
        },
      },
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        return ctx.$q.when({ data: response, status: 200 });
      };
      ctx.ds.metricFindQuery(query).then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
    });

    it('should return list of all column values', function() {
      expect(results.length).to.be(6);
      expect(results[0].text).to.be('aTitle');
      expect(results[5].text).to.be('some text3');
    });
  });

  describe('When performing metricFindQuery with key, value columns', function() {
    let results;
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          meta: {
            rowCount: 3,
          },
          refId: 'tempvar',
          tables: [
            {
              columns: [{ text: '__value' }, { text: '__text' }],
              rows: [['value1', 'aTitle'], ['value2', 'aTitle2'], ['value3', 'aTitle3']],
            },
          ],
        },
      },
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        return ctx.$q.when({ data: response, status: 200 });
      };
      ctx.ds.metricFindQuery(query).then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
    });

    it('should return list of as text, value', function() {
      expect(results.length).to.be(3);
      expect(results[0].text).to.be('aTitle');
      expect(results[0].value).to.be('value1');
      expect(results[2].text).to.be('aTitle3');
      expect(results[2].value).to.be('value3');
    });
  });

  describe('When performing metricFindQuery with key, value columns and with duplicate keys', function() {
    let results;
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          meta: {
            rowCount: 3,
          },
          refId: 'tempvar',
          tables: [
            {
              columns: [{ text: '__text' }, { text: '__value' }],
              rows: [['aTitle', 'same'], ['aTitle', 'same'], ['aTitle', 'diff']],
            },
          ],
        },
      },
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        return ctx.$q.when({ data: response, status: 200 });
      };
      ctx.ds.metricFindQuery(query).then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
    });

    it('should return list of unique keys', function() {
      expect(results.length).to.be(1);
      expect(results[0].text).to.be('aTitle');
      expect(results[0].value).to.be('same');
    });
  });

  describe('When interpolating variables', () => {
    beforeEach(function() {
      ctx.variable = new CustomVariable({}, {});
    });

    describe('and value is a string', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).to.eql('abc');
      });
    });

    describe('and value is a number', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable(1000, ctx.variable)).to.eql(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        expect(ctx.ds.interpolateVariable(['a', 'b', 'c'], ctx.variable)).to.eql("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).to.eql("'abc'");
      });
    });

    describe('and variable allows all and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.includeAll = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).to.eql("'abc'");
      });
    });
  });
});
