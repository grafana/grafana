import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import React, { FC } from 'react';
import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const PanelAlertTab: FC<Props> = ({ dashboard, panel }) => {
  const styles = useStyles2(getStyles);

  console.log(dashboard, panel);

  return (
    <div className={styles.noRulesWrapper}>
      <p>There are no alert rules linked to this panel.</p>
      {dashboard.meta.canEdit && <NewRuleFromPanelButton panel={panel} dashboard={dashboard} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  noRulesWrapper: css`
    margin: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(3)};
  `,
});
