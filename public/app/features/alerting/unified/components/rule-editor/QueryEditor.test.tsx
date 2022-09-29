import { render } from '@testing-library/react';
import React from 'react';
import { byLabelText, byTestId, byText } from 'testing-library-selector';

import { getDefaultRelativeTimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setDataSourceSrv } from '@grafana/runtime';

import { MockDataSourceApi } from '../../../../../../test/mocks/datasource_srv';
import { ExpressionDatasourceUID, instanceSettings } from '../../../../expressions/ExpressionDatasource';
import { mockDataSource, MockDataSourceSrv } from '../../mocks';
import { getDefaultQueries } from '../../utils/rule-form';

import { QueryEditor } from './QueryEditor';

const ui = {
  queryNames: byTestId<HTMLButtonElement>('query-name-div'),
  dataSourcePicker: byLabelText<HTMLDivElement>(selectors.components.DataSourcePicker.container),
  noDataSourcesWarning: byText('You appear to have no compatible data sources'),
};

const onChangeMock = jest.fn();
describe('Query Editor', () => {
  it('should maintain the original query time range when duplicating it', () => {
    const query = {
      refId: 'A',
      queryType: '',
      datasourceUid: '',
      model: { refId: 'A', hide: false },
      relativeTimeRange: { from: 100, to: 0 },
    };
    const queryEditor = new QueryEditor({
      onChange: onChangeMock,
      value: [query],
    });

    queryEditor.onDuplicateQuery(query);

    expect(onChangeMock).toHaveBeenCalledWith([
      query,
      { ...query, ...{ refId: 'B', model: { refId: 'B', hide: false } } },
    ]);
  });

  it('should use the default query time range if none is set when duplicating a query', () => {
    const query = {
      refId: 'A',
      queryType: '',
      datasourceUid: '',
      model: { refId: 'A', hide: false },
    };
    const queryEditor = new QueryEditor({
      onChange: onChangeMock,
      value: [query],
    });

    queryEditor.onDuplicateQuery(query);

    const defaultRange = getDefaultRelativeTimeRange();

    expect(onChangeMock).toHaveBeenCalledWith([
      query,
      { ...query, ...{ refId: 'B', relativeTimeRange: defaultRange, model: { refId: 'B', hide: false } } },
    ]);
  });

  it('should select first data source supporting alerting when there is no default data source', async () => {
    const dsServer = new MockDataSourceSrv({
      influx: mockDataSource({ name: 'influx' }, { alerting: true }),
      postgres: mockDataSource({ name: 'postgres' }, { alerting: true }),
      [ExpressionDatasourceUID]: instanceSettings,
    });
    dsServer.get = () => Promise.resolve(new MockDataSourceApi());

    setDataSourceSrv(dsServer);

    const defaultQueries = getDefaultQueries();

    render(<QueryEditor onChange={() => null} value={defaultQueries} />);

    const queryRef = await ui.queryNames.findAll();
    const select = await ui.dataSourcePicker.find();

    expect(queryRef).toHaveLength(2);
    expect(queryRef[0]).toHaveTextContent('A');
    expect(queryRef[1]).toHaveTextContent('B');
    expect(select).toHaveTextContent('influx'); // Alphabetical order
    expect(ui.noDataSourcesWarning.query()).not.toBeInTheDocument();
  });

  it('should select the default data source when specified', async () => {
    const dsServer = new MockDataSourceSrv({
      influx: mockDataSource({ name: 'influx' }, { alerting: true }),
      postgres: mockDataSource({ name: 'postgres', isDefault: true }, { alerting: true }),
      [ExpressionDatasourceUID]: instanceSettings,
    });
    dsServer.get = () => Promise.resolve(new MockDataSourceApi());

    setDataSourceSrv(dsServer);

    const defaultQueries = getDefaultQueries();

    render(<QueryEditor onChange={() => null} value={defaultQueries} />);

    const queryRef = await ui.queryNames.findAll();
    const select = await ui.dataSourcePicker.find();

    expect(queryRef).toHaveLength(2);
    expect(select).toHaveTextContent('postgres'); // Default data source
  });
});
