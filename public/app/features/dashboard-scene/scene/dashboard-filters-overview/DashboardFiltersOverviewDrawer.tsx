import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, sceneUtils } from '@grafana/scenes';
import { Drawer, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { DashboardFiltersOverview } from './DashboardFiltersOverview';
import { DashboardFiltersOverviewSearch } from './DashboardFiltersOverviewSearch';

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
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const dashboard = model.getDashboard();

  if (!dashboard) {
    return null;
  }

  const { variables } = sceneGraph.getVariables(dashboard).useState();
  const adHocVar = variables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = variables.find((v) => sceneUtils.isGroupByVariable(v));

  return (
    <Drawer
      title={
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>{t('dashboard.filters-overview.title', 'Edit filters')}</span>
          <DashboardFiltersOverviewSearch value={searchQuery} onChange={setSearchQuery} />
        </div>
      }
      onClose={model.onClose}
      size="sm"
    >
      <DashboardFiltersOverview
        adhocFilters={adHocVar}
        groupByVariable={groupByVar}
        onClose={model.onClose}
        searchQuery={searchQuery}
      />
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  drawerHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    overflow: 'hidden',
    minWidth: 0,
  }),
  drawerTitle: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),
});
