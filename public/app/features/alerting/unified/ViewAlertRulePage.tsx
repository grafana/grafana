import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, PageToolbar, withErrorBoundary, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { parseRuleIdentifier } from './utils/rules';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useObservable } from 'react-use';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;

const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const { id, sourceName } = match.params;
  const { loading, error, result: rule } = useCombinedRule(getIdentifier(id), sourceName);
  const styles = useStyles2(getStyles);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());

  const onRunQueries = useCallback(() => {
    const queries = alertRuleToQueries(rule);

    if (queries.length === 0) {
      return;
    }

    runner.run(queries);
  }, [runner, rule]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  if (!rule) {
    return <div>no alert rule</div>;
  }

  console.log('rule', rule);
  console.log('data', data);

  return (
    <div className={styles.pageWrapper}>
      <Page>
        <PageToolbar title={''} pageIcon="bell">
          <Button variant="primary" type="button">
            Edit
          </Button>
          <Button variant="destructive" type="button">
            Delete
          </Button>
        </PageToolbar>
        <Page.Contents>
          {/* {result.rule.annotations && result.rule.annotations.summary && (
            <>
              <Label>
                Summary
                <textarea value={result.rule.annotations.summary} />
              </Label>
            </>
          )} */}
          <Button variant="secondary" type="button" onClick={onRunQueries}>
            Run Queries
          </Button>
        </Page.Contents>
      </Page>
    </div>
  );
};

const getIdentifier = (id: string | undefined) => {
  if (!id) {
    return undefined;
  }

  return parseRuleIdentifier(decodeURIComponent(id));
};

const getStyles = (theme: GrafanaTheme2) => ({
  pageWrapper: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  `,
  content: css`
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius()};
    margin: ${theme.spacing(0, 2, 2)};
  `,
});

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
