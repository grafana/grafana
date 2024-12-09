import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricFindValue, VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { GroupByVariable } from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { GroupByVariableEditor } from './GroupByVariableEditor';

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
    get: async () => ({
      ...defaultDatasource,
      variables: {
        getType: () => VariableSupportType.Custom,
        query: jest.fn(),
        editor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('GroupByVariableEditor', () => {
  it('renders GroupByVariableForm with correct props', async () => {
    const { renderer } = await setup();
    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect
    );
    const infoText = renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.infoText);
    const allowCustomValueCheckbox = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(infoText).toBeInTheDocument();
    expect(infoText).toHaveTextContent('This data source does not support group by variable yet.');
  });

  it('should update the variable data source when data source picker is changed', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate changing the data source
    await user.click(renderer.getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(renderer.getByText(/prom/i));

    expect(variable.state.datasource).toEqual({ uid: 'prometheus', type: 'prometheus' });
  });

  it('should update the variable default options when static options are enabled', async () => {
    const { renderer, variable, user } = await setup();

    // Simulate toggling static options on
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle)
    );

    expect(variable.state.defaultOptions).toEqual([]);
  });

  it('should update the variable default options when static options are disabled', async () => {
    const { renderer, variable, user } = await setup([{ text: 'A', value: 'A' }]);

    // Simulate toggling static options off
    await user.click(
      renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle)
    );

    expect(variable.state.defaultOptions).toEqual(undefined);
  });
});

async function setup(defaultOptions?: MetricFindValue[]) {
  const onRunQuery = jest.fn();
  const variable = new GroupByVariable({
    name: 'groupByVariable',
    type: 'groupby',
    label: 'Group By',
    datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    defaultOptions,
  });
  return {
    renderer: await act(() => render(<GroupByVariableEditor variable={variable} onRunQuery={onRunQuery} />)),
    variable,
    user: userEvent.setup(),
    mocks: { onRunQuery },
  };
}
