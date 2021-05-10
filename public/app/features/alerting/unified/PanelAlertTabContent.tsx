import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, CustomScrollbar, HorizontalGroup, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import React, { FC } from 'react';
import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
import { CopyPanelURLButton } from './components/panel-alerts-tab/CopyPanelURLButton';

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

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana threshold rules state: {error.message || 'Unknown error.'}</div>
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

  const buttons = dashboard.meta.canEdit ? (
    <div className={styles.buttonGroup}>
      <HorizontalGroup>
        <NewRuleFromPanelButton panel={panel} dashboard={dashboard} />
        <CopyPanelURLButton panel={panel} dashboard={dashboard} />
      </HorizontalGroup>
    </div>
  ) : null;

  if (rules.length) {
    return (
      <>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.innerWrapper}>
            {alert}
            <RulesTable rules={rules} />
            {buttons}
          </div>
        </CustomScrollbar>
      </>
    );
  }

  return (
    <div className={styles.noRulesWrapper}>
      {alert}
      <p>There are no alert rules linked to this panel.</p>
      {buttons}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonGroup: css`
    height: auto;
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
