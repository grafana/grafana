import LanguageProvider from './language_provider';
import { PromQuery } from '../prometheus/types';
import { ElasticDatasource } from './datasource';
import { DataSourceInstanceSettings } from '@grafana/data';
import { ElasticsearchOptions, ElasticsearchQuery } from './types';
import { TemplateSrv } from '../../../features/templating/template_srv';

const templateSrvStub = {
  getAdhocFilters: jest.fn(() => [] as any[]),
  replace: jest.fn((a: string) => a),
} as any;

const dataSource = new ElasticDatasource(
  {
    url: 'http://es.com',
    database: '[asd-]YYYY.MM.DD',
    jsonData: {
      interval: 'Daily',
      esVersion: '2.0.0',
      timeField: '@time',
    },
  } as DataSourceInstanceSettings<ElasticsearchOptions>,
  templateSrvStub as TemplateSrv
);

const baseLogsQuery: Partial<ElasticsearchQuery> = {
  metrics: [{ type: 'logs', id: '1' }],
};

describe('transform prometheus query to elasticsearch query', () => {
  it('With exact equals labels ( 2 labels ) and metric __name__', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: 'my_metric{label1="value1",label2="value2"}' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '__name__:"my_metric" AND label1:"value1" AND label2:"value2"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With exact equals labels ( 1 labels ) and metric __name__', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: 'my_metric{label1="value1"}' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '__name__:"my_metric" AND label1:"value1"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With exact equals labels ( 1 labels )', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: '{label1="value1"}' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: 'label1:"value1"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With no label and metric __name__', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: 'my_metric{}' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '__name__:"my_metric"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With no label and metric __name__ without bracket', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: 'my_metric' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '__name__:"my_metric"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With rate function and exact equals labels ( 2 labels ) and metric __name__', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: 'rate(my_metric{label1="value1",label2="value2"}[5m])' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '__name__:"my_metric" AND label1:"value1" AND label2:"value2"',
        refId: promQuery.refId,
      },
    ]);
  });

  it('With rate function and exact equals labels not equals labels regex and not regex labels and metric __name__', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = {
      refId: 'bar',
      expr: 'rate(my_metric{label1="value1",label2!="value2",label3=~"value.+",label4!~".*tothemoon"}[5m])',
    };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query:
          '__name__:"my_metric" AND label1:"value1" AND NOT label2:"value2" AND label3:/value.+/ AND NOT label4:/.*tothemoon/',
        refId: promQuery.refId,
      },
    ]);
  });
});

describe('transform malformed prometheus query to elasticsearch query', () => {
  it('With only bracket', () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: '{' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '',
        refId: promQuery.refId,
      },
    ]);
  });

  it('Empty query', async () => {
    const instance = new LanguageProvider(dataSource);
    const promQuery: PromQuery = { refId: 'bar', expr: '' };
    const result = instance.importQueries([promQuery], 'prometheus');

    expect(result).toEqual([
      {
        ...baseLogsQuery,
        query: '',
        refId: promQuery.refId,
      },
    ]);
  });
});

describe('Unsupportated datasources', () => {
  it('Generates a default query', async () => {
    const instance = new LanguageProvider(dataSource);
    const someQuery = { refId: 'bar' };
    const result = instance.importQueries([someQuery], 'THIS DATASOURCE TYPE DOESNT EXIST');
    expect(result).toEqual([{ refId: someQuery.refId }]);
  });
});
