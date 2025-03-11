import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { t } from 'app/core/internationalization';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleProvider } from './components/rule-viewer/RuleContext';
import DetailView, { ActiveTab, useActiveTab } from './components/rule-viewer/RuleViewer';
import { useCombinedRule } from './hooks/useCombinedRule';
import { stringifyErrorLike } from './utils/misc';
import { getRuleIdFromPathname, parse as parseRuleId } from './utils/rule-id';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleViewer = (): JSX.Element => {
  const params = useParams();
  const id = getRuleIdFromPathname(params);

  const [activeTab] = useActiveTab();
  const instancesTab = activeTab === ActiveTab.Instances;

  // We will fetch no instances by default to speed up loading times and reduce memory footprint _unless_ we are visiting
  // the "instances" tab. This optimization is only available for the Grafana-managed ruler.
  const limitAlerts = instancesTab ? undefined : 0; // "0" means "do not include alert rule instances in the response"

  // we convert the stringified ID to a rule identifier object which contains additional
  // type and source information
  const identifier = useMemo(() => {
    if (!id) {
      throw new Error('Rule ID is required');
    }

    return parseRuleId(id, true);
  }, [id]);

  // we then fetch the rule from the correct API endpoint(s)
  const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier, limitAlerts });

  if (error) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alert-list">
        <ErrorMessage error={error} />
      </AlertingPageWrapper>
    );
  }

  if (loading) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alert-list" isLoading={true}>
        <></>
      </AlertingPageWrapper>
    );
  }

  if (rule) {
    return (
      <AlertRuleProvider identifier={identifier} rule={rule}>
        <DetailView />
      </AlertRuleProvider>
    );
  }

  // if we get here assume we can't find the rule
  if (!rule && !loading) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alert-list">
        <EntityNotFound entity="Rule" />
      </AlertingPageWrapper>
    );
  }

  // we should never get to this state
  return <></>;
};

export const defaultPageNav: NavModelItem = {
  id: 'alert-rule-view',
  text: '',
};

interface ErrorMessageProps {
  error: unknown;
}

function ErrorMessage({ error }: ErrorMessageProps) {
  if (isFetchError(error) && error.status === 404) {
    return <EntityNotFound entity="Rule" />;
  }

  return (
    <Alert title={t('alerting.rule-viewer.error-loading', 'Something went wrong loading the rule')}>
      {stringifyErrorLike(error)}
    </Alert>
  );
}

export default withPageErrorBoundary(RuleViewer);
