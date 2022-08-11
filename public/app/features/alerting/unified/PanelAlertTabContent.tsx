import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, CustomScrollbar, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
import { getRulesPermissions } from './utils/access-control';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const PanelAlertTabContent: FC<Props> = ({ dashboard, panel }) => {
  const styles = useStyles2(getStyles);
  const { errors, loading, rules } = usePanelCombinedRules({
    dashboard,
    panel,
    poll: true,
  });
  const permissions = getRulesPermissions('grafana');
  const canCreateRules = contextSrv.hasPermission(permissions.create);

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana rules state: {error.message || 'Unknown error.'}</div>
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
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.innerWrapper}>
          {alert}
          <RulesTable rules={rules} />
          {!!dashboard.meta.canSave && canCreateRules && (
            <NewRuleFromPanelButton className={styles.newButton} panel={panel} dashboard={dashboard} />
          )}
        </div>
      </CustomScrollbar>
    );
  }

  return (
    <div aria-label={selectors.components.PanelAlertTabContent.content} className={styles.noRulesWrapper}>
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
  newButton: css`
    margin-top: ${theme.spacing(3)};
  `,
  innerWrapper: css`
    padding: ${theme.spacing(2)};
  `,
  noRulesWrapper: css`
    margin: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(3)};
  `,
});
