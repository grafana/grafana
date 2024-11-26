// add unit test for the DataSourceVariableEditor component

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { DataSourceVariable } from '@grafana/scenes';

import { DataSourceVariableEditor } from './DataSourceVariableEditor';

//mock getDataSorceSrv.getList() to return a list of datasources
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: () => {
      return [
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
    },
  }),
}));

describe('DataSourceVariableEditor', () => {
  it('shoud render correctly with multi and all not checked', () => {
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
    expect(typeSelect.textContent).toBe('ds1');
    expect(multiCheckbox).toBeInTheDocument();
    expect(multiCheckbox).not.toBeChecked();
    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(includeAllCheckbox).toBeInTheDocument();
    expect(includeAllCheckbox).not.toBeChecked();
  });

  it('shoud render correctly with multi and includeAll checked', () => {
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
    expect(typeSelect.textContent).toBe('ds1');
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

// based on styleguide recomendation
function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}
