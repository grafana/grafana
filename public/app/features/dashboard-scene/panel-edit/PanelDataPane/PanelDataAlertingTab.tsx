import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, Tab, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';
import { usePanelCombinedRules } from 'app/features/alerting/unified/hooks/usePanelCombinedRules';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

import { ScenesNewRuleFromPanelButton } from './NewAlertRuleButton';
import { PanelDataPaneTab, PanelDataTabHeaderProps, TabId } from './types';

export interface PanelDataAlertingTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataAlertingTabState> implements PanelDataPaneTab {
  static Component = PanelDataAlertingTabRendered;
  public tabId = TabId.Alert;

  public renderTab(props: PanelDataTabHeaderProps) {
    return <AlertingTab key={this.getTabLabel()} model={this} {...props} />;
  }

  public getTabLabel() {
    return 'Alert';
  }

  public getDashboardUID() {
    const dashboard = this.getDashboard();
    return dashboard.state.uid!;
  }

  public getDashboard() {
    return getDashboardSceneFor(this);
  }

  public getLegacyPanelId() {
    return getPanelIdForVizPanel(this.state.panelRef.resolve());
  }

  public getCanCreateRules() {
    const rulesPermissions = getRulesPermissions('grafana');
    return this.getDashboard().state.meta.canSave && contextSrv.hasPermission(rulesPermissions.create);
  }
}

export function PanelDataAlertingTabRendered({ model }: SceneComponentProps<PanelDataAlertingTab>) {
  const styles = useStyles2(getStyles);

  const { errors, loading, rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getLegacyPanelId(),
  });

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana rules state: {stringifyErrorLike(error)}</div>
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

  const panel = model.state.panelRef.resolve();
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
      label={model.getTabLabel()}
      icon="bell"
      counter={rules.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
