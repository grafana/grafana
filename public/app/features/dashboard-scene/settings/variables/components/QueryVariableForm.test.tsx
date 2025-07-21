import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormEvent } from 'react';
import * as React from 'react';
import { of } from 'rxjs';

import {
  LoadingState,
  PanelData,
  getDefaultTimeRange,
  toDataFrame,
  FieldType,
  VariableSupportType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setRunRequest } from '@grafana/runtime';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';

import { QueryVariableEditorForm } from './QueryVariableForm';

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
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: (uid: string) => (uid === promDatasource.uid ? promDatasource : defaultDatasource),
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

jest.mock('app/features/variables/editor/getVariableQueryEditor', () => ({
  ...jest.requireActual('app/features/variables/editor/getVariableQueryEditor'),
  getVariableQueryEditor: jest.fn(),
}));

describe('QueryVariableEditorForm', () => {
  const mockOnDataSourceChange = jest.fn();
  const mockOnQueryChange = jest.fn();
  const mockOnLegacyQueryChange = jest.fn();
  const mockOnRegExChange = jest.fn();
  const mockOnSortChange = jest.fn();
  const mockOnRefreshChange = jest.fn();
  const mockOnMultiChange = jest.fn();
  const mockOnIncludeAllChange = jest.fn();
  const mockOnAllValueChange = jest.fn();
  const mockOnAllowCustomValueChange = jest.fn();
  const mockOnStaticOptionsChange = jest.fn();
  const mockOnStaticOptionsOrderChange = jest.fn();

  const defaultProps: React.ComponentProps<typeof QueryVariableEditorForm> = {
    datasource: { uid: defaultDatasource.uid, type: defaultDatasource.type },
    onDataSourceChange: mockOnDataSourceChange,
    query: 'my-query',
    onQueryChange: mockOnQueryChange,
    onLegacyQueryChange: mockOnLegacyQueryChange,
    timeRange: getDefaultTimeRange(),
    regex: '.*',
    onRegExChange: mockOnRegExChange,
    sort: VariableSort.alphabeticalAsc,
    onSortChange: mockOnSortChange,
    refresh: VariableRefresh.onDashboardLoad,
    onRefreshChange: mockOnRefreshChange,
    allowCustomValue: true,
    isMulti: true,
    onMultiChange: mockOnMultiChange,
    includeAll: true,
    onIncludeAllChange: mockOnIncludeAllChange,
    allValue: 'custom all value',
    onAllValueChange: mockOnAllValueChange,
    onAllowCustomValueChange: mockOnAllowCustomValueChange,
    onStaticOptionsChange: mockOnStaticOptionsChange,
    onStaticOptionsOrderChange: mockOnStaticOptionsOrderChange,
  };

  async function setup(props?: React.ComponentProps<typeof QueryVariableEditorForm>) {
    jest.mocked(getVariableQueryEditor).mockResolvedValue(LegacyVariableQueryEditor);
    return {
      renderer: await act(() => render(<QueryVariableEditorForm {...defaultProps} {...props} />)),
      user: userEvent.setup(),
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with initializing the components correctly', async () => {
    const {
      renderer: { getByTestId, getByRole },
    } = await setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.inputV2);
    //const queryEditor = getByTestId('query-editor');
    const regexInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );
    const sortSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2
    );
    const refreshSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2
    );

    const multiSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );
    const allowCustomValueSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    const staticOptionsToggle = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
    );

    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(regexInput).toBeInTheDocument();
    expect(regexInput).toHaveValue('.*');
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect).toHaveTextContent('Alphabetical (asc)');
    expect(refreshSelect).toBeInTheDocument();
    expect(getByRole('radio', { name: 'On dashboard load' })).toBeChecked();
    expect(multiSwitch).toBeInTheDocument();
    expect(multiSwitch).toBeChecked();
    expect(allowCustomValueSwitch).toBeInTheDocument();
    expect(allowCustomValueSwitch).toBeChecked();
    expect(includeAllSwitch).toBeInTheDocument();
    expect(includeAllSwitch).toBeChecked();
    expect(allValueInput).toBeInTheDocument();
    expect(allValueInput).toHaveValue('custom all value');
    expect(staticOptionsToggle).toBeInTheDocument();
  });

  it('should call onDataSourceChange when changing the datasource', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.inputV2);
    await userEvent.click(dataSourcePicker);
    await userEvent.click(screen.getByText(/prometheus/i));

    expect(mockOnDataSourceChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataSourceChange).toHaveBeenCalledWith(promDatasource, undefined);
  });

  it('should call onQueryChange when changing the query', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const queryEditor = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
    );

    await waitFor(async () => {
      await userEvent.type(queryEditor, '-new');
      await userEvent.tab();
    });

    expect(mockOnLegacyQueryChange).toHaveBeenCalledTimes(1);
    expect(mockOnLegacyQueryChange).toHaveBeenCalledWith('my-query-new', expect.anything());
  });

  it('should call onRegExChange when changing the regex', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const regexInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );
    await userEvent.type(regexInput, '{backspace}?');
    await userEvent.tab();
    expect(mockOnRegExChange).toHaveBeenCalledTimes(1);
    expect(
      ((mockOnRegExChange.mock.calls[0][0] as FormEvent<HTMLTextAreaElement>).target as HTMLTextAreaElement).value
    ).toBe('.?');
  });

  it('should call onSortChange when changing the sort', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const sortSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2
    );
    await userEvent.click(sortSelect); // open the select
    const anotherOption = await screen.getByText('Alphabetical (desc)');
    await userEvent.click(anotherOption);

    expect(mockOnSortChange).toHaveBeenCalledTimes(1);
    expect(mockOnSortChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: VariableSort.alphabeticalDesc }),
      expect.anything()
    );
  });

  it('should call onRefreshChange when changing the refresh', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const refreshSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2
    );
    await userEvent.click(refreshSelect); // open the select
    const anotherOption = await screen.getByText('On time range change');
    await userEvent.click(anotherOption);

    expect(mockOnRefreshChange).toHaveBeenCalledTimes(1);
    expect(mockOnRefreshChange).toHaveBeenCalledWith(VariableRefresh.onTimeRangeChanged);
  });

  it('should call onMultiChange when changing the multi switch', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const multiSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    await userEvent.click(multiSwitch);
    expect(mockOnMultiChange).toHaveBeenCalledTimes(1);
    expect(
      (mockOnMultiChange.mock.calls[0][0] as FormEvent<HTMLInputElement>).target as HTMLInputElement
    ).toBeChecked();
  });

  it('should call onIncludeAllChange when changing the include all switch', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const includeAllSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    await userEvent.click(includeAllSwitch);
    expect(mockOnIncludeAllChange).toHaveBeenCalledTimes(1);
    expect(
      (mockOnIncludeAllChange.mock.calls[0][0] as FormEvent<HTMLInputElement>).target as HTMLInputElement
    ).toBeChecked();
  });

  it('should call onAllowCustomValue when changing the allow custom value switch', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const allowCustomValue = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );
    await userEvent.click(allowCustomValue);
    expect(mockOnAllowCustomValueChange).toHaveBeenCalledTimes(1);
    expect(
      (mockOnAllowCustomValueChange.mock.calls[0][0] as FormEvent<HTMLInputElement>).target as HTMLInputElement
    ).toBeChecked();
  });

  it('should call onAllValueChange when changing the all value', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );
    await userEvent.type(allValueInput, ' and another value');
    await userEvent.tab();
    expect(mockOnAllValueChange).toHaveBeenCalledTimes(1);
    expect(
      ((mockOnAllValueChange.mock.calls[0][0] as FormEvent<HTMLInputElement>).target as HTMLInputElement).value
    ).toBe('custom all value and another value');
  });

  it('should call onStaticOptionsOrderChange when changing the static options order', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();

    // First enable static options
    const staticOptionsToggle = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
    );
    await userEvent.click(staticOptionsToggle);

    // Then access the dropdown
    const staticOptionsOrderDropdown = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsOrderDropdown
    );
    await userEvent.click(staticOptionsOrderDropdown); // open the select
    const anotherOption = await screen.getByText('After query values');
    await userEvent.click(anotherOption);

    expect(mockOnStaticOptionsOrderChange).toHaveBeenCalledTimes(1);
    expect(mockOnStaticOptionsOrderChange.mock.calls[0][0]).toBe('after');
  });

  it('should call onStaticOptionsChange when adding a static option', async () => {
    const {
      renderer: { getByTestId, getAllByTestId },
    } = await setup();

    // First enable static options
    const staticOptionsToggle = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
    );
    await userEvent.click(staticOptionsToggle);

    const addButton = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsAddButton
    );
    await userEvent.click(addButton);

    // Now enter label and value for the new option
    const labelInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsLabelInput
    );
    const valueInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsValueInput
    );

    // Enter label for the new option (second input)
    await userEvent.type(labelInputs[1], 'New Option Label');
    await userEvent.type(valueInputs[1], 'new-option-value');

    expect(mockOnStaticOptionsChange).toHaveBeenCalled();
    expect(mockOnStaticOptionsChange.mock.lastCall[0]).toEqual([
      { value: 'new-option-value', label: 'New Option Label' },
    ]);
  });

  it('should call onStaticOptionsChange when removing a static option', async () => {
    const {
      renderer: { getAllByTestId },
    } = await setup({
      ...defaultProps,
      staticOptions: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ],
    });

    const deleteButtons = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsDeleteButton
    );

    // Remove the first option
    await userEvent.click(deleteButtons[0]);

    expect(mockOnStaticOptionsChange).toHaveBeenCalledTimes(1);
    // Should call with only the second option remaining
    expect(mockOnStaticOptionsChange.mock.calls[0][0]).toEqual([{ value: 'option2', label: 'Option 2' }]);
  });

  it('should call onStaticOptionsChange when editing a static option label', async () => {
    const {
      renderer: { getAllByTestId },
    } = await setup({
      ...defaultProps,
      staticOptions: [{ value: 'test', label: 'Test Label' }],
    });

    const labelInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsLabelInput
    );

    await userEvent.clear(labelInputs[0]);
    await userEvent.type(labelInputs[0], 'Updated Label');

    expect(mockOnStaticOptionsChange).toHaveBeenCalled();
    expect(mockOnStaticOptionsChange.mock.lastCall[0]).toEqual([{ value: 'test', label: 'Updated Label' }]);
  });

  it('should call onStaticOptionsChange when editing a static option value', async () => {
    const {
      renderer: { getAllByTestId },
    } = await setup({
      ...defaultProps,
      staticOptions: [{ value: 'old-value', label: 'Test Label' }],
    });

    const valueInputs = getAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsValueInput
    );

    await userEvent.clear(valueInputs[0]);
    await userEvent.type(valueInputs[0], 'new-value');

    expect(mockOnStaticOptionsChange).toHaveBeenCalled();
    expect(mockOnStaticOptionsChange.mock.lastCall[0]).toEqual([{ value: 'new-value', label: 'Test Label' }]);
  });

  it('should remove static options and hide UI elements when static options switch is unchecked', async () => {
    const {
      renderer: { getByTestId, queryByTestId, getAllByTestId },
    } = await setup({
      ...defaultProps,
      staticOptions: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ],
    });

    // Static options should be visible initially
    expect(
      getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle)
    ).toBeChecked();
    expect(
      getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsOrderDropdown
      )
    ).toBeInTheDocument();

    // Option rows should be visible
    expect(
      getAllByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsRow)
    ).toHaveLength(2);

    // Uncheck the static options switch
    const staticOptionsToggle = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
    );
    await userEvent.click(staticOptionsToggle);

    // Should call onStaticOptionsChange to remove static options
    expect(mockOnStaticOptionsChange).toHaveBeenCalledTimes(1);
    expect(mockOnStaticOptionsChange).toHaveBeenCalledWith(undefined);

    // Static options UI elements should be hidden
    expect(
      queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsOrderDropdown
      )
    ).not.toBeInTheDocument();
    expect(
      queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsRow)
    ).not.toBeInTheDocument();
  });
});
