import { locationService } from '@grafana/runtime';

import { assistantContext } from './assistantContext';

// The real item reads the data source's name and type from a running Grafana, which a unit test does not have.
jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type: string, params: object) => ({ type, ...params })),
}));

describe('assistantContext', () => {
  beforeEach(() => {
    locationService.replace('/drilldown');
  });

  it('passes the data source chosen for every signal, SQL included, in the order of the data source bar', () => {
    locationService.push(
      '/drilldown?var-ds-metrics=m&var-ds-logs=l&var-ds-traces=t&var-ds-profiles=p&var-ds-knowledgegraph=k&var-ds-sql=orders'
    );

    expect(assistantContext()).toEqual([
      { type: 'datasource', datasourceUid: 'm' },
      { type: 'datasource', datasourceUid: 'l' },
      { type: 'datasource', datasourceUid: 't' },
      { type: 'datasource', datasourceUid: 'p' },
      { type: 'datasource', datasourceUid: 'k' },
      { type: 'datasource', datasourceUid: 'orders' },
    ]);
  });

  it('leaves out a signal that has no data source in the URL', () => {
    locationService.push('/drilldown?var-ds-sql=orders');

    expect(assistantContext()).toEqual([{ type: 'datasource', datasourceUid: 'orders' }]);
  });
});
