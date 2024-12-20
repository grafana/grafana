import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
import { getRulesPermissions } from './utils/access-control';
import { stringifyErrorLike } from './utils/misc';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const PanelAlertTabContent = ({ dashboard, panel }: Props) => {
  const styles = useStyles2(getStyles);
  const { errors, loading, rules } = usePanelCombinedRules({
    dashboardUID: dashboard.uid,
    panelId: panel.id,
    poll: true,
  });
  const permissions = getRulesPermissions('grafana');
  const canCreateRules = contextSrv.hasPermission(permissions.create);

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana rules state: {stringifyErrorLike(error)}</div>
      ))}
    </Alert>
  ) : null;

  if (loading && !rules.length) {
    return (
      <div className={styles.innerWrapper}>
        {alert}
        <LoadingPlaceholder text="Loading rules..." />
      </div>
    );
  }

  if (rules.length) {
    return (
      <ScrollContainer minHeight="100%">
        <div className={styles.innerWrapper}>
          {alert}
          <RulesTable rules={rules} />
          {!!dashboard.meta.canSave && canCreateRules && (
            <NewRuleFromPanelButton className={styles.newButton} panel={panel} dashboard={dashboard} />
          )}
        </div>
      </ScrollContainer>
    );
  }

  return (
    <div data-testid={selectors.components.PanelAlertTabContent.content} className={styles.noRulesWrapper}>
      {alert}
      {!!dashboard.uid && (
        <>
          <p>There are no alert rules linked to this panel.</p>
          {!!dashboard.meta.canSave && canCreateRules && <NewRuleFromPanelButton panel={panel} dashboard={dashboard} />}
        </>
      )}
      {!dashboard.uid && !!dashboard.meta.canSave && (
        <Alert severity="info" title="Dashboard not saved">
          Dashboard must be saved before alerts can be added.
        </Alert>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  newButton: css({
    marginTop: theme.spacing(3),
  }),
  innerWrapper: css({
    padding: theme.spacing(2),
  }),
  noRulesWrapper: css({
    margin: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(3),
  }),
});
