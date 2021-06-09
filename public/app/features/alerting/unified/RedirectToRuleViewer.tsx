import React from 'react';
import { Redirect } from 'react-router-dom';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { withErrorBoundary } from '@grafana/ui';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { createViewLink } from './utils/misc';
import { getRulesSourceByName } from './utils/datasource';
import { RuleViewerLayoutContent } from './components/rule-viewer/RuleViewerLayout';

type RedirectToRuleViewerProps = GrafanaRouteComponentProps<{ name?: string; sourceName?: string }>;

export function RedirectToRuleViewer(props: RedirectToRuleViewerProps): JSX.Element | null {
  const { name, sourceName } = props.match.params;
  const { error, loading, result: rules, dispatched } = useCombinedRulesMatching(name, sourceName);

  if (error) {
    return <div>error</div>;
  }

  if (loading || !dispatched) {
    return <div>loading</div>;
  }

  if (!name || !sourceName) {
    return <Redirect to="" />;
  }

  if (Array.isArray(rules) && rules.length === 1) {
    const [rule] = rules;
    const rulesSource = getRulesSourceByName(sourceName);

    if (!rulesSource) {
      return <div>error</div>;
    }

    return <Redirect to={createViewLink(rulesSource, rule, '/alerting/list')} />;
  }

  return (
    <RuleViewerLayoutContent>
      found: {name} in {sourceName}
    </RuleViewerLayoutContent>
  );
}

export default withErrorBoundary(RedirectToRuleViewer, { style: 'page' });
