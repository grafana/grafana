// add unit test for the DataSourceVariableEditor component

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { DataSourceVariable } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { addToEditedDashboard } from '../variableEditTestUtils';

import { DataSourceVariableEditor, getDataSourceVariableOptions } from './DataSourceVariableEditor';

//mock getDataSourceInstanceList() to return a list of datasources
const dsList = [
  {
    name: 'DataSourceInstance1',
    uid: 'ds1',
    meta: {
      name: 'ds1',
      id: 'dsTestDataSource',
    },
  },
  {
    name: 'DataSourceInstance2',
    uid: 'ds2',
    meta: {
      name: 'ds1',
      id: 'dsTestDataSource',
    },
  },
  {
    name: 'ABCDataSourceInstance',
    uid: 'ds3',
    meta: {
      name: 'abDS',
      id: 'ABCDS',
    },
  },
];

const mockGetList = jest.fn((_args?: { pluginId?: string }) => dsList);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: (args: { pluginId?: string }) => mockGetList(args),
  }),
  getDataSourceInstanceList: jest.fn(async () => dsList),
}));
describe('DataSourceVariableEditor', () => {
  it('shoud render correctly with multi and all not checked', async () => {
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      type: 'datasource',
      label: 'Datasource',
      pluginId: 'dsTestDataSource',
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<DataSourceVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    const allowCustomValueCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    const typeSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
    );
    expect(typeSelect).toBeInTheDocument();
    await waitFor(() => expect(typeSelect.textContent).toBe('ds1'));
    expect(multiCheckbox).toBeInTheDocument();
    expect(multiCheckbox).not.toBeChecked();
    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(includeAllCheckbox).toBeInTheDocument();
    expect(includeAllCheckbox).not.toBeChecked();
  });

  it('shoud render correctly with multi and includeAll checked', async () => {
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      type: 'datasource',
      label: 'Datasource',
      pluginId: 'dsTestDataSource',
      isMulti: true,
      includeAll: true,
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<DataSourceVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    const typeSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
    );
    expect(typeSelect).toBeInTheDocument();
    await waitFor(() => expect(typeSelect.textContent).toBe('ds1'));
    expect(multiCheckbox).toBeInTheDocument();
    expect(multiCheckbox).toBeChecked();
    expect(includeAllCheckbox).toBeInTheDocument();
    expect(includeAllCheckbox).toBeChecked();
  });

  it('Should change type option when users select a different datasource type', async () => {
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      type: 'datasource',
      label: 'Datasource',
      pluginId: 'dsTestDataSource',
      isMulti: false,
      includeAll: false,
    });
    const onRunQuery = jest.fn();

    const { getByTestId, user } = setup(<DataSourceVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const typeSelect = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
    );
    await waitFor(() => expect(typeSelect.textContent).toBe('ds1'));
    // when user change type datasource
    await user.click(typeSelect);
    await user.type(typeSelect, 'abDS');
    await user.keyboard('{enter}');
    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect.textContent).toBe('abDS');
    expect(onRunQuery).toHaveBeenCalledTimes(1);

    // when user change checkbox multi

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    await user.click(multiCheckbox);
    expect(multiCheckbox).toBeChecked();

    // when user include all there is a new call to onRunQuery
    await user.click(includeAllCheckbox);
    expect(includeAllCheckbox).toBeChecked();
    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });
});

describe('getDataSourceVariableOptions', () => {
  const renderPreviewItem = (variable: DataSourceVariable) => {
    const previewItem = getDataSourceVariableOptions(variable).find(
      (item) => item.props.id === 'datasource-options-preview'
    );
    expect(previewItem).toBeDefined();

    return render(previewItem!.props.render(previewItem!));
  };

  const previewedValues = async (findAllByTestId: ReturnType<typeof render>['findAllByTestId']) => {
    const rendered = await findAllByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
    );

    return rendered.map((option) => option.textContent);
  };

  it('renders a values preview listing the resolved data source instances', async () => {
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      type: 'datasource',
      pluginId: 'dsTestDataSource',
    });
    await lastValueFrom(variable.validateAndUpdate!());

    const { findAllByTestId } = renderPreviewItem(variable);

    expect(await previewedValues(findAllByTestId)).toEqual([
      'DataSourceInstance1',
      'DataSourceInstance2',
      'ABCDataSourceInstance',
    ]);
  });

  it('narrows the previewed values to those matching the name filter', async () => {
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      type: 'datasource',
      pluginId: 'dsTestDataSource',
      regex: '/Instance2$/',
    });
    await lastValueFrom(variable.validateAndUpdate!());

    const { findAllByTestId } = renderPreviewItem(variable);

    expect(await previewedValues(findAllByTestId)).toEqual(['DataSourceInstance2']);
  });
});

describe('getDataSourceVariableOptions undo/redo', () => {
  it('records a name filter change as one undoable action', async () => {
    const { nameFilter } = selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable;
    const variable = new DataSourceVariable({ name: 'dsVariable', pluginId: 'dsTestDataSource', regex: '/1$/' });
    const sidebar = addToEditedDashboard(variable);
    const nameFilterItem = getDataSourceVariableOptions(variable).find(
      (item) => item.props.id === 'datasource-options-name-filter'
    );
    const { user } = setup(nameFilterItem!.props.render(nameFilterItem!));

    await user.clear(screen.getByTestId(nameFilter));
    await user.type(screen.getByTestId(nameFilter), '/2$/');
    await user.tab();
    expect(variable.state.regex).toBe('/2$/');
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.regex).toBe('/1$/');
    expect(screen.getByTestId(nameFilter)).toHaveValue('/1$/');

    act(() => sidebar.redoAction());
    expect(variable.state.regex).toBe('/2$/');
    expect(screen.getByTestId(nameFilter)).toHaveValue('/2$/');
  });
});

// based on styleguide recomendation
function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

describe('data source selection undo/redo', () => {
  afterEach(() => mockGetList.mockImplementation(() => dsList));

  it('restores the selected data source when undoing a name filter', async () => {
    const { nameFilter } = selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable;
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      pluginId: 'dsTestDataSource',
      value: 'ds2',
      text: 'DataSourceInstance2',
    });
    const sidebar = addToEditedDashboard(variable);
    await lastValueFrom(variable.validateAndUpdate!());
    expect(variable.state.value).toBe('ds2');
    const item = getDataSourceVariableOptions(variable).find(
      (item) => item.props.id === 'datasource-options-name-filter'
    )!;
    const { user } = setup(item.props.render(item));
    await user.type(screen.getByTestId(nameFilter), '/1$/');
    await user.tab();
    expect(variable.state.value).toBe('ds1');

    act(() => sidebar.undoAction());
    expect(variable.state).toMatchObject({ regex: '', value: 'ds2', text: 'DataSourceInstance2' });

    act(() => sidebar.redoAction());
    expect(variable.state).toMatchObject({ regex: '/1$/', value: 'ds1', text: 'DataSourceInstance1' });
  });

  it('restores a non-default data source selection when undoing a type change', async () => {
    mockBoundingClientRect();
    mockGetList.mockImplementation((args) => dsList.filter((ds) => ds.meta.id === args?.pluginId));
    const variable = new DataSourceVariable({
      name: 'dsVariable',
      pluginId: 'dsTestDataSource',
      value: 'ds2',
      text: 'DataSourceInstance2',
    });
    const sidebar = addToEditedDashboard(variable);
    await lastValueFrom(variable.validateAndUpdate!());
    expect(variable.state.value).toBe('ds2');
    const item = getDataSourceVariableOptions(variable).find((item) => item.props.id === 'datasource-options-type')!;
    const { user } = setup(item.props.render(item));
    const select = screen.getByRole('combobox');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'abDS' }));
    expect(variable.state).toMatchObject({ pluginId: 'ABCDS', value: 'ds3' });

    act(() => sidebar.undoAction());
    expect(variable.state).toMatchObject({ pluginId: 'dsTestDataSource', value: 'ds2', text: 'DataSourceInstance2' });

    act(() => sidebar.redoAction());
    expect(variable.state).toMatchObject({ pluginId: 'ABCDS', value: 'ds3', text: 'ABCDataSourceInstance' });
  });
});
