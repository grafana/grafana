import { render, screen } from '@testing-library/react';
import { type Observable } from 'rxjs';

import {
  DataSourceApi,
  DataSourcePlugin,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourcePluginOptionsEditorProps,
  type TestDataSourceResponse,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { getMockDataSource, getMockDataSourceMeta } from '../mocks/dataSourcesMocks';
import { type GenericDataSourcePlugin } from '../types';

import { DataSourcePluginSettings } from './DataSourcePluginSettings';

class TestDataSource extends DataSourceApi {
  query(_request: DataQueryRequest): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    return Promise.resolve({ data: [] });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

const ConfigEditor = ({ options }: DataSourcePluginOptionsEditorProps) => {
  return <div>Config editor for {options.name}</div>;
};

describe('<DataSourcePluginSettings>', () => {
  it('should render the config editor inside a plugin boundary', () => {
    const plugin: GenericDataSourcePlugin = new DataSourcePlugin(TestDataSource);
    plugin.setConfigEditor(ConfigEditor);
    plugin.meta = getMockDataSourceMeta({ id: 'test-datasource' });

    render(
      <DataSourcePluginSettings
        plugin={plugin}
        dataSource={getMockDataSource()}
        dataSourceMeta={plugin.meta}
        onModelChange={jest.fn()}
      />
    );

    const boundary = screen.getByTestId(selectors.components.Plugins.dataSourceConfigEditor('test-datasource'));
    expect(boundary).toHaveAttribute('data-plugin-id', 'test-datasource');
    expect(screen.getByText('Config editor for gdev-cloudwatch')).toBeVisible();
  });
});
