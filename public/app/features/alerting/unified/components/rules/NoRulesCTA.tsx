import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src/themes';
import { CallToActionCard, useStyles2, Stack } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

import { logInfo, LogMessages } from '../../Analytics';
import { useRulesAccess } from '../../utils/accessControlHooks';

export const NoRulesSplash = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();
  const styles = useStyles2(getStyles);
  if (canCreateGrafanaRules || canCreateCloudRules) {
    return (
      <div>
        <p>{"You haven't created any alert rules yet"}</p>
        <Stack gap={1}>
          <div className={styles.newRuleCard}>
            <EmptyListCTA
              title=""
              buttonIcon="bell"
              buttonLink={'alerting/new/alerting'}
              buttonTitle="New alert rule"
              proTip="you can also create alert rules from existing panels and queries."
              proTipLink="https://grafana.com/docs/"
              proTipLinkTitle="Learn more"
              proTipTarget="_blank"
              onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
            />
          </div>

          <div className={styles.newRuleCard}>
            <EmptyListCTA
              title=""
              buttonIcon="plus"
              buttonLink={'alerting/new/recording'}
              buttonTitle="New recording rule"
              onClick={() => logInfo(LogMessages.recordingRuleFromScratch)}
            />
          </div>
        </Stack>
      </div>
    );
  }
  return <CallToActionCard message="No rules exist yet." callToActionElement={<div />} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  newRuleCard: css`
    width: calc(50% - ${theme.spacing(1)});

    > div {
      height: 100%;
    }
  `,
});
