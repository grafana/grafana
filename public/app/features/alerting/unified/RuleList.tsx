import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { SystemOrApplicationAlerts } from './components/rules/SystemOrApplicationRules';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchRulesAction } from './state/actions';
import { getRulesDataSources } from './utils/datasource';

export const RuleList: FC = () => {
  const dispatch = useDispatch();

  // trigger fetch for any rules sources that dont have results and are not currently loading
  useEffect(() => getRulesDataSources().forEach((ds) => dispatch(fetchRulesAction(ds.name))), []);

  const rules = useUnifiedAlertingSelector((state) => state.rules);

  const requests = Object.values(rules);
  const dispatched = !!requests.find((r) => r.dispatched);
  const loading = !!requests.find((r) => r.loading);
  const haveResults = !!requests.find((r) => !r.loading && r.dispatched && (r.result?.length || !!r.error));

  return (
    <AlertingPageWrapper isLoading={loading && !haveResults}>
      {dispatched && !loading && !haveResults && <NoRulesSplash />}
      {haveResults && <SystemOrApplicationAlerts />}
    </AlertingPageWrapper>
  );
};
