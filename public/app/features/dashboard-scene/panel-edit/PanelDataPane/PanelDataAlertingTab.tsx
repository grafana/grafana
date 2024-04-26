import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, Tab, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';
import { usePanelCombinedRules } from 'app/features/alerting/unified/hooks/usePanelCombinedRules';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';

import { ScenesNewRuleFromPanelButton } from './NewAlertRuleButton';
import { PanelDataPaneTabState, PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataAlertingTabRendered;
  TabComponent: (props: PanelDataTabHeaderProps) => React.JSX.Element;

  tabId = TabId.Alert;
  private _panelManager: VizPanelManager;

  constructor(panelManager: VizPanelManager) {
    super({});
    this.TabComponent = (props: PanelDataTabHeaderProps) => AlertingTab({ ...props, model: this });
    this._panelManager = panelManager;
  }

  getTabLabel() {
    return 'Alert';
  }

  getDashboardUID() {
    const dashboard = this.getDashboard();
    return dashboard.state.uid!;
  }

  getDashboard() {
    return getDashboardSceneFor(this._panelManager);
  }

  getLegacyPanelId() {
    return getPanelIdForVizPanel(this._panelManager.state.panel);
  }

  getCanCreateRules() {
    const rulesPermissions = getRulesPermissions('grafana');
    return this.getDashboard().state.meta.canSave && contextSrv.hasPermission(rulesPermissions.create);
  }

  get panelManager() {
    return this._panelManager;
  }

  get panel() {
    return this._panelManager.state.panel;
  }
}

export function PanelDataAlertingTabRendered(props: SceneComponentProps<PanelDataAlertingTab>) {
  const { model } = props;

  const styles = useStyles2(getStyles);

  const { errors, loading, rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getLegacyPanelId(),
  });

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana rules state: {error.message || 'Unknown error.'}</div>
      ))}
    </Alert>
  ) : null;

  if (loading && !rules.length) {
    return (
      <>
        {alert}
        <LoadingPlaceholder text="Loading rules..." />
      </>
    );
  }

  const { panel } = model;
  const canCreateRules = model.getCanCreateRules();

  if (rules.length) {
    return (
      <>
        <RulesTable rules={rules} />
        {canCreateRules && <ScenesNewRuleFromPanelButton className={styles.newButton} panel={panel} />}
      </>
    );
  }

  return (
    <div className={styles.noRulesWrapper}>
      <p>There are no alert rules linked to this panel.</p>
      {canCreateRules && <ScenesNewRuleFromPanelButton panel={panel}></ScenesNewRuleFromPanelButton>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  newButton: css({
    marginTop: theme.spacing(3),
  }),
  noRulesWrapper: css({
    margin: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(3),
  }),
});
interface PanelDataAlertingTabHeaderProps extends PanelDataTabHeaderProps {
  model: PanelDataAlertingTab;
}

function AlertingTab(props: PanelDataAlertingTabHeaderProps) {
  const { model } = props;

  const { rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getLegacyPanelId(),
    poll: false,
  });

  return (
    <Tab
      key={props.key}
      label={model.getTabLabel()}
      icon="bell"
      counter={rules.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
