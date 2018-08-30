import OpenTsDatasource from '../datasource';
import $q from 'q';

describe('opentsdb', () => {
  const ctx = <any>{
    backendSrv: {},
    ds: {},
    templateSrv: {
      replace: str => str,
    },
  };
  const instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };

  beforeEach(() => {
    ctx.ctrl = new OpenTsDatasource(instanceSettings, $q, ctx.backendSrv, ctx.templateSrv);
  });

  describe('When performing metricFindQuery', () => {
    let results;
    let requestOptions;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = await function(options) {
        requestOptions = options;
        return Promise.resolve({
          data: [{ target: 'prod1.count', datapoints: [[10, 1], [12, 1]] }],
        });
      };
    });

    it('metrics() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('metrics(pew)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('metrics');
      expect(requestOptions.params.q).toBe('pew');
      expect(results).not.toBe(null);
    });

    it('tag_names(cpu) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_names(cpu)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*}');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname, env=$env)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*,env=$env}');
    });

    it('tag_values(cpu, test) should generate lookup query', () => {
      ctx.ctrl.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/search/lookup');
      expect(requestOptions.params.m).toBe('cpu{hostname=*,env=$env,region=$region}');
    });

    it('suggest_tagk() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('suggest_tagk(foo)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('tagk');
      expect(requestOptions.params.q).toBe('foo');
    });

    it('suggest_tagv() should generate api suggest query', () => {
      ctx.ctrl.metricFindQuery('suggest_tagv(bar)').then(function(data) {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/suggest');
      expect(requestOptions.params.type).toBe('tagv');
      expect(requestOptions.params.q).toBe('bar');
    });
  });
});
