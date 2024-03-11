import React from 'react';

import { NavModelItem } from '@grafana/data';
import { config, isFetchError } from '@grafana/runtime';
import { Alert, withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleProvider } from './components/rule-viewer/v2/RuleContext';
import { useCombinedRule } from './hooks/useCombinedRule';
import { stringifyErrorLike } from './utils/misc';
import { getRuleIdFromPathname, parse as parseRuleId } from './utils/rule-id';

const DetailViewV1 = SafeDynamicImport(() => import('./components/rule-viewer/RuleViewer.v1'));
const DetailViewV2 = React.lazy(() => import('./components/rule-viewer/v2/RuleViewer.v2'));

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

const newAlertDetailView = Boolean(config.featureToggles?.alertingDetailsViewV2) === true;

const RuleViewer = (props: RuleViewerProps): JSX.Element => {
  return newAlertDetailView ? <RuleViewerV2Wrapper {...props} /> : <RuleViewerV1Wrapper {...props} />;
};

export const defaultPageNav: NavModelItem = {
  id: 'alert-rule-view',
  text: '',
};

const RuleViewerV1Wrapper = (props: RuleViewerProps) => <DetailViewV1 {...props} />;

const RuleViewerV2Wrapper = (props: RuleViewerProps) => {
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
        <DetailViewV2 />
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
