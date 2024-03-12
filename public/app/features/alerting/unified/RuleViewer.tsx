import React from 'react';

import { NavModelItem } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Alert, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleProvider } from './components/rule-viewer/RuleContext';
import DetailView from './components/rule-viewer/RuleViewer';
import { useCombinedRule } from './hooks/useCombinedRule';
import { stringifyErrorLike } from './utils/misc';
import { getRuleIdFromPathname, parse as parseRuleId } from './utils/rule-id';

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

const RuleViewer = (props: RuleViewerProps): JSX.Element => {
  const id = getRuleIdFromPathname(props.match.params);

  // we convert the stringified ID to a rule identifier object which contains additional
  // type and source information
  const identifier = React.useMemo(() => {
    if (!id) {
      throw new Error('Rule ID is required');
    }

    return parseRuleId(id, true);
  }, [id]);

  // we then fetch the rule from the correct API endpoint(s)
  const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });

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
  return (
    <AlertingPageWrapper pageNav={defaultPageNav} navId="alert-list">
      <EntityNotFound entity="Rule" />
    </AlertingPageWrapper>
  );
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

  return <Alert title={'Something went wrong loading the rule'}>{stringifyErrorLike(error)}</Alert>;
}

export default withErrorBoundary(RuleViewer, { style: 'page' });
