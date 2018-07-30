import moment from 'moment';
import { ElasticDatasource } from '../datasource';
import $q from 'q';

const timeFrom = 1432288354;
const timeTo = 1432288401;
const timeMock = { from: moment(timeFrom), to: moment(timeTo) };

describe('ElasticDatasource', () => {
  let ctx = {} as any;

  const createContext = () => {
    ctx = {
      templateSrv: {
        replace: jest.fn(text => text),
        getAdhocFilters: jest.fn(() => []),
      },
      backendSrv: {
        datasourceRequest: jest.fn(() => Promise.resolve('data')),
      },
      timeSrv: {
        timeRange: jest.fn(() => ({
          from: timeMock.from,
          to: timeMock.to,
        })),
        setTime: jest.fn(() => {}),
      },
    };
    ctx.ds = new ElasticDatasource(
      { id: 1, name: 'es', jsonData: { timeField: '@timestamp' } },
      $q,
      ctx.backendSrv,
      ctx.templateSrv,
      ctx.timeSrv
    );
    ctx.ds.responseTransformer = {
      transformTimeSeriesQueryResult: jest.fn(),
      transformAnnotationQueryResponse: jest.fn(),
      transformFieldsQueryResponse: jest.fn(),
      transformTermsQueryResponse: jest.fn(),
    };

    return ctx;
  };

  beforeEach(() => {
    ctx = createContext();
  });

  it('when calling post should call backendSrv with expected payload', async () => {
    await ctx.ds.post('test');

    expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(1);
    expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledWith({
      url: '/api/tsdb/query',
      method: 'POST',
      data: 'test',
    });
  });

  describe('execute query', () => {
    it('with no targets should not call backendSrv', async () => {
      const options = {
        targets: [],
      };
      await ctx.ds.query(options);
      expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(0);
    });

    it('with only hidden targets should not call backendSrv', async () => {
      const options = {
        targets: [{ hide: true }],
      };
      await ctx.ds.query(options);
      expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(0);
    });

    it('with targets should call backendSrv and response transformer', async () => {
      const options = {
        range: {
          from: moment(timeFrom),
          to: moment(timeTo),
        },
        intervalMs: 1000,
        targets: [
          {
            refId: 'A',
            alias: 'cpu count',
            query: '@metric:cpu',
            timeField: '@timestamp',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
            metrics: [{ type: 'count', id: '0' }],
          },
          {
            refId: 'B',
            alias: 'mem count',
            query: '@metric:mem',
            timeField: '@timestamp',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
            metrics: [{ type: 'count', id: '0' }],
          },
        ],
      };
      ctx.templateSrv.getAdhocFilters = jest.fn(() => [{}]);
      await ctx.ds.query(options);

      expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(1);
      const data = ctx.backendSrv.datasourceRequest.mock.calls[0][0].data;
      expect(data.from).toBe(timeFrom.toString());
      expect(data.to).toBe(timeTo.toString());
      expect(data.queries).toHaveLength(2);
      const q1 = data.queries[0];
      expect(q1.queryType).toBe('timeseries');
      expect(q1.refId).toBe('A');
      expect(q1.datasourceId).toBe(1);
      expect(q1.intervalMs).toBe(1000);
      expect(q1.timeField).toBe('@timestamp');
      expect(q1.alias).toBe('cpu count');
      expect(q1.query).toBe('@metric:cpu');
      expect(q1.bucketAggs).toHaveLength(1);
      expect(q1.metrics).toHaveLength(1);
      expect(q1.adhocFilters).toHaveLength(1);
      const q2 = data.queries[1];
      expect(q2.queryType).toBe('timeseries');
      expect(q2.refId).toBe('B');
      expect(q2.datasourceId).toBe(1);
      expect(q1.intervalMs).toBe(1000);
      expect(q2.timeField).toBe('@timestamp');
      expect(q2.alias).toBe('mem count');
      expect(q2.query).toBe('@metric:mem');
      expect(q2.bucketAggs).toHaveLength(1);
      expect(q2.metrics).toHaveLength(1);
      expect(q1.adhocFilters).toHaveLength(1);

      expect(ctx.templateSrv.replace).toHaveBeenCalledTimes(4);
      expect(ctx.templateSrv.replace.mock.calls[0][0]).toBe('@metric:cpu');
      expect(ctx.templateSrv.replace.mock.calls[1][0]).toBe('cpu count');
      expect(ctx.templateSrv.replace.mock.calls[2][0]).toBe('@metric:mem');
      expect(ctx.templateSrv.replace.mock.calls[3][0]).toBe('mem count');

      expect(ctx.ds.responseTransformer.transformTimeSeriesQueryResult).toHaveBeenCalledTimes(1);
      expect(ctx.ds.responseTransformer.transformTimeSeriesQueryResult).toHaveBeenCalledWith('data');
    });
  });

  it('when executing annotationQuery should call backendSrv and response transformer', async () => {
    const annotationName = 'MyAnno';
    const options = {
      annotation: {
        name: annotationName,
        timeField: '@timestamp',
        textField: 'description',
        tagsField: '@tags',
        query: '@metric:cpu',
      },
      range: {
        from: moment(timeFrom),
        to: moment(timeTo),
      },
    };
    await ctx.ds.annotationQuery(options);

    expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(1);
    const data = ctx.backendSrv.datasourceRequest.mock.calls[0][0].data;
    expect(data.from).toBe(timeFrom.toString());
    expect(data.to).toBe(timeTo.toString());
    expect(data.queries).toHaveLength(1);
    const q = data.queries[0];
    expect(q.queryType).toBe('annotation');
    expect(q.refId).toBe('MyAnno');
    expect(q.datasourceId).toBe(1);
    expect(q.annotation.timeField).toBe('@timestamp');
    expect(q.annotation.textField).toBe('description');
    expect(q.annotation.tagsField).toBe('@tags');
    expect(q.annotation.query).toBe('@metric:cpu');

    expect(ctx.ds.responseTransformer.transformAnnotationQueryResponse).toHaveBeenCalledTimes(1);
    expect(ctx.ds.responseTransformer.transformAnnotationQueryResponse).toHaveBeenCalledWith(
      options.annotation,
      'data'
    );
  });

  it('when executing getFields should call backendSrv and response parser', async () => {
    const query = {
      type: 'number',
    };
    await ctx.ds.getFields(query, 'ref');

    expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(1);
    const data = ctx.backendSrv.datasourceRequest.mock.calls[0][0].data;
    expect(data.from).toBe(timeFrom.toString());
    expect(data.to).toBe(timeTo.toString());
    expect(data.queries).toHaveLength(1);
    const q = data.queries[0];
    expect(q.queryType).toBe('fields');
    expect(q.refId).toBe('ref');
    expect(q.datasourceId).toBe(1);
    expect(q.fieldTypeFilter).toBe('number');

    expect(ctx.ds.responseTransformer.transformFieldsQueryResponse).toHaveBeenCalledTimes(1);
    expect(ctx.ds.responseTransformer.transformFieldsQueryResponse).toHaveBeenCalledWith('ref', 'data');
  });

  it('when executing getTerms should call backendSrv and response parser', async () => {
    const query = {
      field: '@hostname',
      query: '@metric:cpu',
      size: 5,
    };
    await ctx.ds.getTerms(query, 'ref');

    expect(ctx.backendSrv.datasourceRequest).toHaveBeenCalledTimes(1);
    const data = ctx.backendSrv.datasourceRequest.mock.calls[0][0].data;
    expect(data.from).toBe(timeFrom.toString());
    expect(data.to).toBe(timeTo.toString());
    expect(data.queries).toHaveLength(1);
    const q = data.queries[0];
    expect(q.queryType).toBe('terms');
    expect(q.refId).toBe('ref');
    expect(q.datasourceId).toBe(1);
    expect(q.field).toBe('@hostname');
    expect(q.query).toBe('@metric:cpu');
    expect(q.size).toBe(5);

    expect(ctx.ds.responseTransformer.transformTermsQueryResponse).toHaveBeenCalledTimes(1);
    expect(ctx.ds.responseTransformer.transformTermsQueryResponse).toHaveBeenCalledWith('ref', 'data');
  });

  describe('testDatasource', () => {
    it('with existing time field should return success', async () => {
      ctx.ds.getFields = () => Promise.resolve([{ text: '@timestamp' }]);
      const result = await ctx.ds.testDatasource();

      expect(result.status).toBe('success');
      expect(result.message).toBe('Index OK. Time field name OK.');
    });

    it('with non-existing time field should return error', async () => {
      ctx.ds.getFields = () => Promise.resolve([{ text: 'time' }]);
      const result = await ctx.ds.testDatasource();

      expect(result.status).toBe('error');
      expect(result.message).toBe('No date field named @timestamp found');
    });
  });
});
