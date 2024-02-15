import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { AdHocVariableForm } from './AdHocVariableForm';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  uid: 'test-ds',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  uid: 'prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => ({
  ...jest.requireActual('@grafana/runtime/src/services/dataSourceSrv'),
  getDataSourceSrv: () => ({
    get: async () => defaultDatasource,
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('AdHocVariableForm', () => {
  it('should render the form with the provided data source', async () => {
    const onDataSourceChange = jest.fn();
    const { renderer } = await setup({
      datasource: defaultDatasource,
      onDataSourceChange,
      infoText: 'Test Info',
    });

    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
    );
    const infoText = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText
    );

    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(infoText).toBeInTheDocument();
    expect(infoText).toHaveTextContent('Test Info');
  });

  it('should call the onDataSourceChange callback when the data source is changed', async () => {
    const onDataSourceChange = jest.fn();
    const { renderer, user } = await setup({
      datasource: defaultDatasource,
      onDataSourceChange,
      infoText: 'Test Info',
    });

    // Simulate changing the data source
    await user.click(renderer.getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(renderer.getByText(/prom/i));

    expect(onDataSourceChange).toHaveBeenCalledTimes(1);
    expect(onDataSourceChange).toHaveBeenCalledWith(promDatasource, undefined);
  });
});

async function setup(props?: React.ComponentProps<typeof AdHocVariableForm>) {
  return {
    renderer: await act(() => render(<AdHocVariableForm onDataSourceChange={jest.fn()} {...props} />)),
    user: userEvent.setup(),
  };
}
