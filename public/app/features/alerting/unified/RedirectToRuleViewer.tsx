import React from 'react';
import { Redirect } from 'react-router-dom';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { createViewLink } from './utils/misc';
import { getRulesSourceByName } from './utils/datasource';
import { RuleViewerLayout } from './components/rule-viewer/RuleViewerLayout';
import { AlertLabels } from './components/AlertLabels';

type RedirectToRuleViewerProps = GrafanaRouteComponentProps<{ name?: string; sourceName?: string }>;

export function RedirectToRuleViewer(props: RedirectToRuleViewerProps): JSX.Element | null {
  const { name, sourceName } = props.match.params;
  const styles = useStyles2(getStyles);
  const { error, loading, result: rules, dispatched } = useCombinedRulesMatching(name, sourceName);

  if (error) {
    return <div>error</div>;
  }

  if (loading || !dispatched || !Array.isArray(rules)) {
    return (
      <RuleViewerLayout>
        <LoadingPlaceholder text="Loading rule..." />
      </RuleViewerLayout>
    );
  }

  if (!name || !sourceName) {
    return <Redirect to="" />;
  }

  const rulesSource = getRulesSourceByName(sourceName);

  if (!rulesSource) {
    return null;
  }

  if (rules.length === 1) {
    const [rule] = rules;
    return <Redirect to={createViewLink(rulesSource, rule, '/alerting/list')} />;
  }

  return (
    <RuleViewerLayout>
      <div>
        Several rules in <span className={styles.param}>{sourceName}</span> matched the name{' '}
        <span className={styles.param}>{name}</span>, please select the rule you want to view.
      </div>
      <div className={styles.rules}>
        {rules.map((rule, index) => {
          return (
            <Card
              key={`${rule.name}-${index}`}
              heading={rule.name}
              href={createViewLink(rulesSource, rule, '/alerting/list')}
            >
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
  };
}

export default withErrorBoundary(RedirectToRuleViewer, { style: 'page' });
