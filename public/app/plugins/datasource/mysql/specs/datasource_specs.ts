import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import {MysqlDatasource} from '../datasource';

describe('MySQLDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {name: 'mysql'};

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['backendSrv']));

  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.ds = $injector.instantiate(MysqlDatasource, {instanceSettings: instanceSettings});
    $httpBackend.when('GET', /\.html$/).respond('');
  }));

  describe('When performing annotationQuery', function() {
    let results;

    const annotationName = 'MyAnno';

    const options = {
      annotation: {
        name: annotationName,
        rawQuery: 'select time_sec, title, text, tags from table;'
      },
      range: {
        from: moment(1432288354),
        to: moment(1432288401)
      }
    };

    const response = {
      results: {
        MyAnno: {
          refId: annotationName,
          tables: [
            {
              columns: [{text: 'time_sec'}, {text: 'title'}, {text: 'text'}, {text: 'tags'}],
              rows: [
                [1432288355, 'aTitle', 'some text', 'TagA,TagB'],
                [1432288390, 'aTitle2', 'some text2', ' TagB , TagC'],
                [1432288400, 'aTitle3', 'some text3']
              ]
            }
          ]
        }
      }
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        return ctx.$q.when({data: response, status: 200});
      };
      ctx.ds.annotationQuery(options).then(function(data) { results = data; });
      ctx.$rootScope.$apply();
    });

    it('should return annotation list', function() {
      expect(results.length).to.be(3);

      expect(results[0].title).to.be('aTitle');
      expect(results[0].text).to.be('some text');
      expect(results[0].tags[0]).to.be('TagA');
      expect(results[0].tags[1]).to.be('TagB');

      expect(results[1].tags[0]).to.be('TagB');
      expect(results[1].tags[1]).to.be('TagC');

      expect(results[2].tags.length).to.be(0);
    });
  });

});
