import { AbstractLabelOperator, AbstractQuery } from '@grafana/data';

import { TemplateSrv } from '../../../features/templating/template_srv';

import LanguageProvider from './LanguageProvider';
import { ElasticDatasource } from './datasource';
import { createElasticDatasource } from './mocks';
import { ElasticsearchQuery } from './types';

const baseLogsQuery: Partial<ElasticsearchQuery> = {
  metrics: [{ type: 'logs', id: '1' }],
};

describe('transform abstract query to elasticsearch query', () => {
  let datasource: ElasticDatasource;
  beforeEach(() => {
    const templateSrvStub = {
      getAdhocFilters: jest.fn(() => []),
      replace: jest.fn((a: string) => a),
    } as unknown as TemplateSrv;

    datasource = createElasticDatasource({}, templateSrvStub);
  });

  it('With some labels', () => {
    const instance = new LanguageProvider(datasource);
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
      query: 'label1:"value1" AND -label2:"value2" AND label3:/value3/ AND -label4:/value4/',
      refId: abstractQuery.refId,
    });
  });

  it('Empty query', () => {
    const instance = new LanguageProvider(datasource);
    const abstractQuery = { labelMatchers: [], refId: 'foo' };
    const result = instance.importFromAbstractQuery(abstractQuery);

    expect(result).toEqual({
      ...baseLogsQuery,
      query: '',
      refId: abstractQuery.refId,
    });
  });
});
