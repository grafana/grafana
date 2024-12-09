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
});
