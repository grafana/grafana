import { css } from '@emotion/css';
import React from 'react';
import { Redirect } from 'react-router-dom';
import { useLocation } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Card, Icon, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';

import { AlertLabels } from './components/AlertLabels';
import { RuleViewerLayout } from './components/rule-viewer/RuleViewerLayout';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { getRulesSourceByName } from './utils/datasource';
import { createViewLink } from './utils/misc';

const pageTitle = 'Find rule';

function useRuleFindParams() {
  // DO NOT USE REACT-ROUTER HOOKS FOR THIS CODE
  // React-router's useLocation/useParams/props.match are broken and don't preserve original param values when parsing location
  // so, they cannot be used to parse name and sourceName path params
  // React-router messes the pathname up resulting in a string that is neither encoded nor decoded
  // Relevant issue: https://github.com/remix-run/history/issues/505#issuecomment-453175833
  // It was probably fixed in React-Router v6
  const location = useLocation();
  const segments = location.pathname?.split('/') ?? []; // ["", "alerting", "{sourceName}", "{name}]

  const name = decodeURIComponent(segments[3]);
  const sourceName = decodeURIComponent(segments[2]);

  return { name, sourceName };
}

export function RedirectToRuleViewer(): JSX.Element | null {
  const styles = useStyles2(getStyles);

  const { name, sourceName } = useRuleFindParams();
  const { error, loading, result: rules, dispatched } = useCombinedRulesMatching(name, sourceName);

  if (error) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title={`Failed to load rules from ${sourceName}`}>
          <details className={styles.errorMessage}>
            {error.message}
            <br />
            {!!error?.stack && error.stack}
          </details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  if (loading || !dispatched || !Array.isArray(rules)) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <LoadingPlaceholder text="Loading rule..." />
      </RuleViewerLayout>
    );
  }

  if (!name || !sourceName) {
    return <Redirect to="/notfound" />;
  }

  const rulesSource = getRulesSourceByName(sourceName);

  if (!rulesSource) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title="Could not view rule">
          <details className={styles.errorMessage}>{`Could not find data source with name: ${sourceName}.`}</details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  if (rules.length === 1) {
    const [rule] = rules;
    return <Redirect to={createViewLink(rulesSource, rule, '/alerting/list')} />;
  }

  return (
    <RuleViewerLayout title={pageTitle}>
      <div>
        Several rules in <span className={styles.param}>{sourceName}</span> matched the name{' '}
        <span className={styles.param}>{name}</span>, please select the rule you want to view.
      </div>
      <div className={styles.rules}>
        {rules.map((rule, index) => {
          return (
            <Card key={`${rule.name}-${index}`} href={createViewLink(rulesSource, rule, '/alerting/list')}>
              <Card.Heading>{rule.name}</Card.Heading>
              <Card.Meta separator={''}>
                <Icon name="folder" />
                <span className={styles.namespace}>{`${rule.namespace.name} / ${rule.group.name}`}</span>
              </Card.Meta>
              <Card.Tags>
                <AlertLabels labels={rule.labels} />
              </Card.Tags>
            </Card>
          );
        })}
      </div>
    </RuleViewerLayout>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    param: css`
      font-style: italic;
      color: ${theme.colors.text.secondary};
    `,
    rules: css`
      margin-top: ${theme.spacing(2)};
    `,
    namespace: css`
      margin-left: ${theme.spacing(1)};
    `,
    errorMessage: css`
      white-space: pre-wrap;
    `,
  };
}

export default withErrorBoundary(RedirectToRuleViewer, { style: 'page' });
