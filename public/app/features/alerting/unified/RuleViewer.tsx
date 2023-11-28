import React, { useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { useCombinedRule } from './hooks/useCombinedRule';
import { getRuleIdFromPathname, parse as parseRuleId } from './utils/rule-id';

const DetailViewV1 = SafeDynamicImport(() => import('./components/rule-viewer/RuleViewer.v1'));
const DetailViewV2 = React.lazy(() => import('./components/rule-viewer/v2/RuleViewer.v2'));

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

const newAlertDetailView = Boolean(config.featureToggles.alertingDetailsViewV2) === true;

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
  const identifier = useMemo(() => {
    if (!id) {
      throw new Error('Rule ID is required');
    }

    return parseRuleId(id, true);
  }, [id]);

  const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });

  // TODO improve error handling here
  if (error) {
    if (typeof error === 'string') {
      return error;
    }

    return <Alert title={'Uh-oh'}>Something went wrong loading the rule</Alert>;
  }

  if (loading) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alert-list" isLoading={true}>
        <></>
      </AlertingPageWrapper>
    );
  }

  if (rule) {
    return <DetailViewV2 rule={rule} identifier={identifier} />;
  }

  return null;
};

export default withErrorBoundary(RuleViewer, { style: 'page' });
