import { AdHocFiltersVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { dashboardEditActions } from '../shared';

import { openAddFilterForm } from './AddFilters';

jest.mock('../shared', () => ({
  dashboardEditActions: {
    addVariable: jest.fn(),
  },
}));

const addVariableMock = jest.mocked(dashboardEditActions.addVariable);

describe('openAddFilterForm', () => {
  beforeEach(() => {
    addVariableMock.mockClear();
  });

  it('adds an adhoc filter to the dashboard variable set', () => {
    const variableSet = new SceneVariableSet({ variables: [] });
    const dashboard = new DashboardScene({ $variables: variableSet, isEditing: true });
    jest.spyOn(dashboard.state.editPane, 'selectObject');

    openAddFilterForm(dashboard, dashboard);

    expect(addVariableMock).toHaveBeenCalledTimes(1);
    const { source, addedObject } = addVariableMock.mock.calls[0][0];
    expect(source).toBe(variableSet);
    expect(addedObject).toBeInstanceOf(AdHocFiltersVariable);
    expect(dashboard.state.editPane.selectObject).toHaveBeenCalledWith(addedObject, { force: true, multi: false });
  });

  it('adds an adhoc filter to a section variable set', () => {
    const sectionVarSet = new SceneVariableSet({ variables: [] });
    const row = new RowItem({
      $variables: sectionVarSet,
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const dashboard = new DashboardScene({
      body: new RowsLayoutManager({ rows: [row] }),
      isEditing: true,
    });
    jest.spyOn(dashboard.state.editPane, 'selectObject');

    openAddFilterForm(dashboard, row);

    expect(addVariableMock).toHaveBeenCalledTimes(1);
    const { source, addedObject } = addVariableMock.mock.calls[0][0];
    expect(source).toBe(sectionVarSet);
    expect(addedObject).toBeInstanceOf(AdHocFiltersVariable);
    expect(dashboard.state.editPane.selectObject).toHaveBeenCalledWith(addedObject, { force: true, multi: false });
  });

  it('creates a variable set on the section if none exists', () => {
    const row = new RowItem({ layout: AutoGridLayoutManager.createEmpty() });
    const dashboard = new DashboardScene({
      body: new RowsLayoutManager({ rows: [row] }),
      isEditing: true,
    });
    jest.spyOn(dashboard.state.editPane, 'selectObject');

    expect(row.state.$variables).toBeUndefined();

    openAddFilterForm(dashboard, row);

    expect(row.state.$variables).toBeInstanceOf(SceneVariableSet);
    expect(addVariableMock).toHaveBeenCalledTimes(1);
    const { source, addedObject } = addVariableMock.mock.calls[0][0];
    expect(source).toBe(row.state.$variables);
    expect(addedObject).toBeInstanceOf(AdHocFiltersVariable);
  });

  it('generates a unique name when filters already exist', () => {
    const existingFilter = new AdHocFiltersVariable({ name: 'filter0', type: 'adhoc' });
    const sectionVarSet = new SceneVariableSet({ variables: [existingFilter] });
    const row = new RowItem({
      $variables: sectionVarSet,
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const dashboard = new DashboardScene({
      body: new RowsLayoutManager({ rows: [row] }),
      isEditing: true,
    });
    jest.spyOn(dashboard.state.editPane, 'selectObject');

    openAddFilterForm(dashboard, row);

    const { addedObject } = addVariableMock.mock.calls[0][0];
    expect(addedObject.state.name).not.toBe('filter0');
  });
});
