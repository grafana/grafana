import { getByRole, render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { lastValueFrom, of } from 'rxjs';

import {
  VariableSupportType,
  PanelData,
  LoadingState,
  toDataFrame,
  getDefaultTimeRange,
  FieldType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setRunRequest } from '@grafana/runtime';
import { QueryVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { QueryVariableEditor } from './QueryVariableEditor';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
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
        getDefaultQuery: () => 'default-query',
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

setRunRequest(runRequestMock);

describe('QueryVariableEditor', () => {
  const onRunQueryMock = jest.fn();

  async function setup(props?: React.ComponentProps<typeof QueryVariableEditor>) {
    const variable = new QueryVariable({
      datasource: {
        uid: defaultDatasource.uid,
        type: defaultDatasource.type,
      },
      query: 'my-query',
      regex: '.*',
      sort: VariableSort.alphabeticalAsc,
      refresh: VariableRefresh.onDashboardLoad,
      isMulti: true,
      includeAll: true,
      allValue: 'custom all value',
    });

    return {
      renderer: await act(() => {
        return render(<QueryVariableEditor variable={variable} onRunQuery={onRunQueryMock} {...props} />);
      }),
      variable,
      user: userEvent.setup(),
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with initializing the components correctly', async () => {
    const { renderer } = await setup();
    const dataSourcePicker = renderer.getByTestId(selectors.components.DataSourcePicker.inputV2);
    const queryEditor = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
    );
    const regexInput = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );
    const sortSelect = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2
    );
    const refreshSelect = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2
    );

    const multiSwitch = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllSwitch = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    const allValueInput = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    const allowCustomValueCheckbox = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(queryEditor).toBeInTheDocument();
    expect(queryEditor).toHaveValue('my-query');
    expect(regexInput).toBeInTheDocument();
    expect(regexInput).toHaveValue('.*');
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect).toHaveTextContent('Alphabetical (asc)');
    expect(refreshSelect).toBeInTheDocument();
    expect(getByRole(refreshSelect, 'radio', { name: 'On dashboard load' })).toBeChecked();
    expect(multiSwitch).toBeInTheDocument();
    expect(multiSwitch).toBeChecked();
    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(includeAllSwitch).toBeInTheDocument();
    expect(includeAllSwitch).toBeChecked();
    expect(allValueInput).toBeInTheDocument();
    expect(allValueInput).toHaveValue('custom all value');
  });

  it('should update the variable with default query for the selected DS', async () => {
    const onRunQueryMock = jest.fn();
    const variable = new QueryVariable({ datasource: { uid: 'mock-ds-2', type: 'test' }, query: '' });

    const {
      renderer: { getByTestId },
    } = await setup({
      variable,
      onRunQuery: onRunQueryMock,
    });

    const queryInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
    );

    await waitFor(async () => {
      expect(onRunQueryMock).toHaveBeenCalledTimes(1);
      expect(queryInput).toHaveValue('default-query');

      await lastValueFrom(variable.validateAndUpdate());
      expect(variable.state.query).toBe('default-query');
    });
  });

  it('should update variable state when changing the datasource', async () => {
    const {
      variable,
      renderer: { getByTestId, getByText },
      user,
    } = await setup();

    expect(variable.state.datasource).toEqual({ uid: 'mock-ds-2', type: 'test' });

    await user.click(getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(getByText(/prom/i));

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.datasource).toEqual({ uid: 'mock-ds-3', type: 'prometheus' });
    expect(variable.state.query).toBe('default-query');
    expect(variable.state.definition).toBe('default-query');
  });

  it('should update the variable state when changing the query', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const queryEditor = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
    );

    await waitFor(async () => {
      await user.type(queryEditor, '-new');
      await user.tab();
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.query).toEqual('my-query-new');
    expect(onRunQueryMock).toHaveBeenCalledTimes(1);
  });

  it('should update the variable state when changing the regex', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const regexInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );

    await waitFor(async () => {
      await user.type(regexInput, '{backspace}?');
      await user.tab();
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.regex).toBe('.?');
  });

  it('should update the variable state when changing the sort', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const sortSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2
    );

    await waitFor(async () => {
      await user.click(sortSelect);
      const anotherOption = await screen.getByText('Alphabetical (desc)');
      await user.click(anotherOption);
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.sort).toBe(VariableSort.alphabeticalDesc);
  });

  it('should update the variable query definition when changing the query', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const queryEditor = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
    );

    await user.type(queryEditor, '-new');
    await user.tab();

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.definition).toEqual('my-query-new');

    await user.clear(queryEditor);

    await user.type(queryEditor, 'new definition');
    await user.tab();

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.definition).toEqual('new definition');

    await user.clear(queryEditor);
    await user.tab();

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.definition).toEqual('');
  });

  it('should update the variable state when changing the refresh', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const refreshSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2
    );

    await waitFor(async () => {
      await user.click(refreshSelect);
      const anotherOption = await screen.getByText('On time range change');
      await user.click(anotherOption);
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.refresh).toBe(VariableRefresh.onTimeRangeChanged);
  });

  it('should update the variable state when changing the multi switch', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const multiSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );

    await waitFor(async () => {
      await user.click(multiSwitch);
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.isMulti).toBe(false);
  });

  it('should update the variable state when changing the include all switch', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const includeAllSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    await waitFor(async () => {
      await user.click(includeAllSwitch);
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.includeAll).toBe(false);
  });

  it('should update the variable state when changing the all value', async () => {
    const {
      variable,
      renderer: { getByTestId },
      user,
    } = await setup();
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    await waitFor(async () => {
      await user.type(allValueInput, ' and another value');
      await user.tab();
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.allValue).toBe('custom all value and another value');
  });
});
