import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, Tab, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
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
    return (
      config.unifiedAlerting &&
      this.getDashboard().state.meta.canSave &&
      contextSrv.hasPermission(rulesPermissions.create)
    );
  }
}

export function PanelDataAlertingTabRendered({ model }: SceneComponentProps<PanelDataAlertingTab>) {
  const styles = useStyles2(getStyles);

  const { errors, loading, rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getLegacyPanelId(),
  });

  const alert = errors.length ? (
    <Alert
      title={t(
        'dashboard-scene.panel-data-alerting-tab-rendered.alert.title-errors-loading-rules',
        'Errors loading rules'
      )}
      severity="error"
    >
      {errors.map((error, index) => (
        <div key={index}>
          <Trans
            i18nKey="dashboard-scene.panel-data-alerting-tab-rendered.error-failed-to-load"
            values={{ errorToDisplay: stringifyErrorLike(error) }}
          >
            Failed to load Grafana rules state: {'{{errorToDisplay}}'}
          </Trans>
        </div>
      ))}
    </Alert>
  ) : null;

  if (loading && !rules.length) {
    return (
      <>
        {alert}
        <LoadingPlaceholder
          text={t('dashboard-scene.panel-data-alerting-tab-rendered.text-loading-rules', 'Loading rules...')}
        />
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

  const isNew = !Boolean(model.getDashboardUID());
  const dashboard = model.getDashboard();

  return (
    <div className={styles.noRulesWrapper}>
      {!isNew && (
        <>
          <p>
            <Trans i18nKey="dashboard.panel-edit.alerting-tab.no-rules">
              There are no alert rules linked to this panel.
            </Trans>
          </p>
          {canCreateRules && <ScenesNewRuleFromPanelButton panel={panel}></ScenesNewRuleFromPanelButton>}
        </>
      )}
      {isNew && !!dashboard.state.meta.canSave && (
        <Alert
          severity="info"
          title={t('dashboard-scene.panel-data-alerting-tab-rendered.title-dashboard-not-saved', 'Dashboard not saved')}
        >
          <Trans i18nKey="dashboard.panel-edit.alerting-tab.dashboard-not-saved">
            Dashboard must be saved before alerts can be added.
          </Trans>
        </Alert>
      )}
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
