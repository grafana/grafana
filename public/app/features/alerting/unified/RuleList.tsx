import React, { FC } from 'react';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { SystemOrApplicationAlerts } from './components/rules/SystemOrApplicationRules';

export const RuleList: FC = () => {
  return (
    <AlertingPageWrapper>
      <SystemOrApplicationAlerts />
    </AlertingPageWrapper>
  );
};
