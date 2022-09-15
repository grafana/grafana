import { css } from '@emotion/css';
import React from 'react';

import { DateTime, GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { FieldSet, HorizontalGroup, Label, Switch, TimeRangeInput, useStyles2, VerticalGroup } from '@grafana/ui/src';
import { TimeModel } from 'app/features/dashboard/state/TimeModel';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

export const PubDashConfiguration = ({
  disabled,
  isPubDashEnabled,
  hasTemplateVariables,
  time,
}: {
  disabled: boolean;
  isPubDashEnabled?: boolean;
  hasTemplateVariables: boolean;
  time: { from: DateTime | string; to: DateTime | string; timeZone: TimeModel };
}) => {
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
  const styles = useStyles2(getStyles);

  const timeRange = getTimeRange({ from: time.from, to: time.to }, time.timeZone);

  return (
    <FieldSet disabled={disabled} className={styles.dashboardConfig}>
      <VerticalGroup spacing="md">
        <HorizontalGroup spacing="xs" justify="space-between">
          <Label description="The public dashboard uses the default time settings of the dashboard">Time Range</Label>
          <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
        </HorizontalGroup>
        <HorizontalGroup spacing="xs" justify="space-between">
          <Label description="Configures whether current dashboard can be available publicly">Enabled</Label>
          <Switch
            disabled={hasTemplateVariables}
            data-testid={selectors.EnableSwitch}
            value={isPubDashEnabled}
            onChange={() => {
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: isPubDashEnabled ? 'disable' : 'enable',
              });

              // setPublicDashboardConfig({
              //   ...publicDashboard,
              //   isEnabled: !publicDashboard.isEnabled,
              // });
            }}
          />
        </HorizontalGroup>
      </VerticalGroup>
    </FieldSet>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  dashboardConfig: css`
    margin: ${theme.spacing(0, 0, 3, 0)};
  `,
});
