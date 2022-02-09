import LanguageProvider from './language_provider';
import { ElasticDatasource } from './datasource';
import { AbstractLabelOperator, AbstractQuery, DataSourceInstanceSettings } from '@grafana/data';
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

describe('transform abstract query to elasticsearch query', () => {
  it('With some labels', () => {
    const instance = new LanguageProvider(dataSource);
    const abstractQuery: AbstractQuery = {
      refId: 'bar',
      labelMatchers: [
        { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
        { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
        { name: 'label3', operator: AbstractLabelOperator.EqualRegEx, value: 'value3' },
        { name: 'label4', operator: AbstractLabelOperator.NotEqualRegEx, value: 'value4' },
      ],
    };
    const result = instance.importFromAbstractQuery(abstractQuery);

    expect(result).toEqual({
      ...baseLogsQuery,
      query: 'label1:"value1" AND NOT label2:"value2" AND label3:/value3/ AND NOT label4:/value4/',
      refId: abstractQuery.refId,
    });
  });

  it('Empty query', () => {
    const instance = new LanguageProvider(dataSource);
    const abstractQuery = { labelMatchers: [], refId: 'foo' };
    const result = instance.importFromAbstractQuery(abstractQuery);

    expect(result).toEqual({
      ...baseLogsQuery,
      query: '',
      refId: abstractQuery.refId,
    });
  });
});
