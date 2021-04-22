import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import React, { FC } from 'react';
import { locationUtil } from '@grafana/data';

export const NoRulesSplash: FC = () => (
  <EmptyListCTA
    title="You haven`t created any alert rules yet"
    buttonIcon="bell"
    buttonLink={locationUtil.assureBaseUrl('/alerting/new')}
    buttonTitle="New alert rule"
    proTip="you can also create alert rules from existing panels and queries."
    proTipLink="https://grafana.com/docs/"
    proTipLinkTitle="Learn more"
    proTipTarget="_blank"
  />
);
