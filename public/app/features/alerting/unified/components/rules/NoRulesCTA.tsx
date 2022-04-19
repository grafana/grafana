import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import React, { FC } from 'react';
import { useRulesAccess } from '../../utils/accessControlHooks';

export const NoRulesSplash: FC = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();

  if (canCreateGrafanaRules || canCreateCloudRules) {
    return (
      <EmptyListCTA
        title="You haven`t created any alert rules yet"
        buttonIcon="bell"
        buttonLink={'alerting/new'}
        buttonTitle="New alert rule"
        proTip="you can also create alert rules from existing panels and queries."
        proTipLink="https://grafana.com/docs/"
        proTipLinkTitle="Learn more"
        proTipTarget="_blank"
      />
    );
  }
  return <CallToActionCard message="No rules exist yet." callToActionElement={<div />} />;
};
