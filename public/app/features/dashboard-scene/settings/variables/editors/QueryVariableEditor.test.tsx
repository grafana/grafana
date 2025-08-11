import { getByRole, render, screen, act, waitFor, within } from '@testing-library/react';
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
import { QueryVariable, TextBoxVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { QueryVariableEditor, getQueryVariableOptions, Editor } from './QueryVariableEditor';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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

    const staticOptionsToggle = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
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
    expect(staticOptionsToggle).toBeInTheDocument();
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

  it('should update the variable state when adding two static options', async () => {
    const {
      variable,
      renderer: { getByTestId, getAllByTestId },
      user,
    } = await setup();

    // Initially no static options
    expect(variable.state.staticOptions).toBeUndefined();

    // First enable static options
    const staticOptionsToggle = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
    );
    await userEvent.click(staticOptionsToggle);

    // Add first static option
    const addButton = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsAddButton
    );
    await user.click(addButton);

    // Enter label and value for first option
    const labelInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsLabelInput
    );
    const valueInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsValueInput
    );

    await user.type(labelInputs[0], 'First Option');
    await user.type(valueInputs[0], 'first-value');

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.staticOptions).toEqual([{ label: 'First Option', value: 'first-value' }]);

    // Add second static option
    await user.click(addButton);

    // Get updated inputs (now there should be 2 sets)
    const updatedLabelInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsLabelInput
    );
    const updatedValueInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsValueInput
    );

    // Enter label and value for second option
    await user.type(updatedLabelInputs[1], 'Second Option');
    await user.type(updatedValueInputs[1], 'second-value');

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.staticOptions).toEqual([
      { label: 'First Option', value: 'first-value' },
      { label: 'Second Option', value: 'second-value' },
    ]);
  });

  it('should return an empty array if variable is not a QueryVariable', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const variable = new TextBoxVariable({ name: 'test', value: 'test value' });
    const result = getQueryVariableOptions(variable);
    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith('getQueryVariableOptions: variable is not a QueryVariable');
    consoleWarnSpy.mockRestore();
  });

  it('should return an OptionsPaneItemDescriptor that renders ModalEditor with expected interactions', async () => {
    const variable = new QueryVariable({
      name: 'test',
      datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
      query: 'initial query',
    });
    const refreshOptionsSpy = jest.spyOn(variable, 'refreshOptions');

    const result = getQueryVariableOptions(variable);

    expect(result.length).toBe(1);
    const descriptor = result[0];

    // Mock the parent property that OptionsPaneItem expects
    descriptor.parent = new OptionsPaneCategoryDescriptor({
      id: 'mock-parent-id',
      title: 'Mock Parent',
    });

    const { queryByRole } = render(descriptor.render());
    const user = userEvent.setup();

    // 1. Initial state: "Open variable editor" button is visible, Modal is not.
    const openEditorButton = screen.getByRole('button', { name: 'Open variable editor' });
    expect(openEditorButton).toBeInTheDocument();
    expect(queryByRole('dialog')).not.toBeInTheDocument(); // Modal has role 'dialog'

    // 2. Opening Modal
    await user.click(openEditorButton);
    const modal = await screen.findByRole('dialog'); // wait for modal to appear
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Query Variable')).toBeInTheDocument(); // Modal title

    // 3. Assert Editor's key elements are rendered
    // DataSourcePicker's Field
    expect(within(modal).getByLabelText('Target data source')).toBeInTheDocument();
    // Regex input placeholder
    expect(within(modal).getByPlaceholderText(/text>.*value/i)).toBeInTheDocument();
    // Sort select (check for its current value display)
    expect(within(modal).getByText('Disabled')).toBeInTheDocument(); // Default sort is 0 (Disabled)
    // Refresh select (check for its current value display)
    expect(within(modal).getByRole('radio', { name: /on dashboard load/i })).toBeChecked(); // Default refresh

    // 4. Assert Preview and Close buttons are visible
    const previewButton = within(modal).getByRole('button', { name: 'Preview' });
    // To distinguish from the header 'X' (aria-label="Close"), find the span with text "Close" and get its parent button.
    const closeButtonTextSpan = within(modal).getByText(/^Close$/);
    const closeButton = closeButtonTextSpan.closest('button')!;
    expect(previewButton).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();

    // 5. Preview button calls variable.refreshOptions()
    await user.click(previewButton);
    expect(refreshOptionsSpy).toHaveBeenCalledTimes(1);

    // 6. Closing Modal
    await user.click(closeButton);
    await waitFor(() => {
      expect(queryByRole('dialog')).not.toBeInTheDocument();
    });

    refreshOptionsSpy.mockRestore();
  });
});

describe('Editor', () => {
  const variable = new QueryVariable({
    datasource: {
      uid: defaultDatasource.uid,
      type: defaultDatasource.type,
    },
    query: '',
    regex: '.*',
  });

  it('should update variable state when datasource is changed', async () => {
    await act(async () => {
      render(<Editor variable={variable} />);
    });

    const dataSourcePicker = screen.getByLabelText('Target data source');
    expect(dataSourcePicker).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(dataSourcePicker);
    await user.click(screen.getByText(/prom/i));

    await waitFor(async () => {
      await lastValueFrom(variable.validateAndUpdate());
    });

    expect(variable.state.datasource).toEqual({ uid: 'mock-ds-3', type: 'prometheus' });
  });
});
