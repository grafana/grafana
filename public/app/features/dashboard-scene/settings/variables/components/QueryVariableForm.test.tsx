import { getByRole, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FormEvent } from 'react';
import { of } from 'rxjs';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import {
  DataSourcePluginMeta,
  dateTime,
  LoadingState,
  PanelData,
  getDefaultTimeRange,
  toDataFrame,
  FieldType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setRunRequest } from '@grafana/runtime';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { VariableQueryEditorProps } from 'app/features/variables/types';

import { QueryVariableEditorForm } from './QueryVariableForm';

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

const mockDsMeta = {
  info: {
    logos: {
      small: `test.png`,
    },
  },
} as DataSourcePluginMeta;
const mockDatasource = new MockDataSourceApi('my-test-ds', undefined, mockDsMeta);
const mockDatasource2 = new MockDataSourceApi('my-test-ds2', undefined, mockDsMeta);
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => ({
  ...jest.requireActual('@grafana/runtime/src/services/dataSourceSrv'),
  getDataSourceSrv: () => ({
    get: async () => mockDatasource,
    getList: () => [mockDatasource, mockDatasource2],
    getInstanceSettings: () => ({ uid: 'my-test-ds', type: 'test', name: 'my-test-ds', meta: mockDsMeta }),
  }),
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

  const MockVariableQueryEditor = ({ datasource, query, onChange, templateSrv }: VariableQueryEditorProps) => (
    <div>
      <p>{datasource.uid}</p>
      <p>{datasource.name}</p>
      <p>{query}</p>
      <p>TemplateSrv received: {!!templateSrv}</p>
      <input data-testid="query-editor" onChange={(e) => onChange('query from input', 'query definition')} />
    </div>
  );

  const defaultProps = {
    datasource: mockDatasource,
    onDataSourceChange: mockOnDataSourceChange,
    query: 'my-query',
    onQueryChange: mockOnQueryChange,
    onLegacyQueryChange: mockOnLegacyQueryChange,
    timeRange: {
      from: dateTime('now-6h'),
      to: dateTime('now'),
      raw: { from: 'now-6h', to: 'now' },
    },
    VariableQueryEditor: MockVariableQueryEditor,
    regex: '.*',
    onRegExChange: mockOnRegExChange,
    sort: VariableSort.alphabeticalAsc,
    onSortChange: mockOnSortChange,
    refresh: VariableRefresh.onDashboardLoad,
    onRefreshChange: mockOnRefreshChange,
    isMulti: true,
    onMultiChange: mockOnMultiChange,
    includeAll: true,
    onIncludeAllChange: mockOnIncludeAllChange,
    allValue: 'custom all value',
    onAllValueChange: mockOnAllValueChange,
  };

  function setup(props?: React.ComponentProps<typeof QueryVariableEditorForm>) {
    return render(<QueryVariableEditorForm {...defaultProps} {...props} />);
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with initializing the components correctly', () => {
    const { getByTestId } = setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.container);
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

    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker).toHaveTextContent('my-test-ds');
    expect(regexInput).toBeInTheDocument();
    expect(regexInput).toHaveValue('.*');
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect).toHaveTextContent('Alphabetical (asc)');
    expect(refreshSelect).toBeInTheDocument();
    expect(getByRole(refreshSelect, 'radio', { name: 'On dashboard load' })).toBeChecked();
    expect(multiSwitch).toBeInTheDocument();
    expect(multiSwitch).toBeChecked();
    expect(includeAllSwitch).toBeInTheDocument();
    expect(includeAllSwitch).toBeChecked();
    expect(allValueInput).toBeInTheDocument();
    expect(allValueInput).toHaveValue('custom all value');
  });

  it.skip('should call onDataSourceChange when changing the datasource', async () => {
    const { getByTestId } = setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.container).getElementsByTagName('input');
    await userEvent.type(dataSourcePicker[0], 'my-new-ds{enter}');
    expect(mockOnDataSourceChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataSourceChange).toHaveBeenCalledWith({
      uid: 'my-new-ds',
      type: 'test',
      name: 'my-new-ds',
      meta: mockDsMeta,
    });
  });

  it.skip('should call onQueryChange when changing the query', async () => {
    const { getByTestId } = setup();
    const queryEditor = getByTestId('query-editor');
    await userEvent.type(queryEditor, 'my-new-query');
    expect(mockOnQueryChange).toHaveBeenCalledTimes(1);
    expect(mockOnQueryChange).toHaveBeenCalledWith('my-new-query');
  });

  it('should call onRegExChange when changing the regex', async () => {
    const { getByTestId } = setup();
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
    const { getByTestId } = setup();
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
    const { getByTestId } = setup();
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
    const { getByTestId } = setup();
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
    const { getByTestId } = setup();
    const includeAllSwitch = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    await userEvent.click(includeAllSwitch);
    expect(mockOnIncludeAllChange).toHaveBeenCalledTimes(1);
    expect(
      (mockOnIncludeAllChange.mock.calls[0][0] as FormEvent<HTMLInputElement>).target as HTMLInputElement
    ).toBeChecked();
  });

  it('should call onAllValueChange when changing the all value', async () => {
    const { getByTestId } = setup();
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
