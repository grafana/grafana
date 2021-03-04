import React, { FC } from 'react';
import { config } from '@grafana/runtime';
import { RuleList } from './unified/RuleList';
import AlertRuleList from './AlertRuleList';

// route between unified and "old" alerting pages based on feature flag
const AlertRuleListIndex: FC = () => {
  return config.featureToggles.ngalert ? <RuleList /> : <AlertRuleList />;
};

export default AlertRuleListIndex;
