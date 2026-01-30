import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, sceneUtils } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { DashboardFiltersOverview } from './DashboardFiltersOverview';

interface DashboardFiltersOverviewDrawerState extends SceneObjectState {}

export class DashboardFiltersOverviewDrawer extends SceneObjectBase<DashboardFiltersOverviewDrawerState> {
  static Component = DashboardFiltersOverviewDrawerRenderer;

  private _dashboard?: DashboardScene;

  constructor(state: DashboardFiltersOverviewDrawerState) {
    super(state);

    this.addActivationHandler(() => {
      this._dashboard = getDashboardSceneFor(this);
    });
  }

  public getDashboard() {
    return this._dashboard;
  }

  onClose = () => {
    this._dashboard?.closeModal();
  };
}

function DashboardFiltersOverviewDrawerRenderer({ model }: SceneComponentProps<DashboardFiltersOverviewDrawer>) {
  const dashboard = model.getDashboard();

  if (!dashboard) {
    return null;
  }

  const { variables } = sceneGraph.getVariables(dashboard).useState();
  const adHocVar = variables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = variables.find((v) => sceneUtils.isGroupByVariable(v));

  return (
    <Drawer title={t('dashboard.filters-verview.title', 'Edit filters')} onClose={model.onClose} size="sm">
      <DashboardFiltersOverview adhocFilters={adHocVar} groupByVariable={groupByVar} onClose={model.onClose} />
    </Drawer>
  );
}
