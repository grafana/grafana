import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { PageToolbar, withErrorBoundary, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';
import { RuleState } from './components/rules/RuleState';
import { VizWrapper } from './components/rule-editor/VizWrapper';
import { SupportedPanelPlugins } from './components/rule-editor/QueryWrapper';
import { TABLE, TIMESERIES } from './utils/constants';
import { isExpressionQuery } from '../../expressions/guards';
import { ruleIdentifierFromParam } from './utils/rules';
import { RuleDetails } from './components/rules/RuleDetails';
import { getRulesSourceByName } from './utils/datasource';
import { CombinedRule } from 'app/types/unified-alerting';
import { DetailsField } from './components/DetailsField';
import { RuleHealth } from './components/rules/RuleHealth';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import { getDataSourceSrv } from '@grafana/runtime';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;

const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const styles = useStyles2(getStyles);
  const { id, sourceName } = match.params;
  const identifier = ruleIdentifierFromParam(id);
  const { loading, error, result: rule } = useCombinedRule(identifier, sourceName);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());
  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0) {
      runner.run(queries);
    }
  }, [queries, runner]);

  useEffect(() => {
    onRunQueries();
  }, [onRunQueries]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  if (!sourceName) {
    return <div>no alert rule</div>;
  }

  const rulesSource = getRulesSourceByName(sourceName);

  if (!rulesSource) {
    return <div>could not find data source</div>;
  }

  if (loading) {
    return <div>loading rule</div>;
  }

  if (error) {
    return <div>could not load rule due to error</div>;
  }

  if (!rule) {
    return <div>no rule</div>;
  }

  return (
    <Page>
      <PageToolbar title={`${renderGroup(rule)} / ${rule.name}`} pageIcon="bell" />
      <div className={styles.content}>
        <div>
          <RuleState rule={rule} isCreating={false} isDeleting={false} />
        </div>
        <div>
          <RuleDetails rulesSource={rulesSource} rule={rule} />
          {rule.promRule && (
            <DetailsField label="Health" horizontal={true}>
              <RuleHealth rule={rule.promRule} />
            </DetailsField>
          )}
        </div>
        <div>
          <div className={styles.label}>Queries</div>
          {queries.map((query) => {
            return (
              <div key={query.refId}>
                <AlertQueryViz
                  query={query}
                  data={data && data[query.refId]}
                  defaultPanel={isExpressionQuery(query.model) ? TABLE : TIMESERIES}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
};

type AlertQueryVizProps = {
  data?: PanelData;
  defaultPanel?: SupportedPanelPlugins;
  query: AlertQuery;
};

function AlertQueryViz(props: AlertQueryVizProps): JSX.Element | null {
  const styles = useStyles2(getVizStyles);
  const { data, defaultPanel = 'timeseries', query } = props;
  const [panel, setPanel] = useState<SupportedPanelPlugins>(defaultPanel);
  const dsSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);

  if (!data) {
    return null;
  }
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <span className={styles.refId}>{query.refId}</span>
          {dsSettings && <span className={styles.datasource}>{dsSettings.name}</span>}
        </div>
      </div>
      <div className={styles.content}>
        <VizWrapper data={data} currentPanel={panel} changePanel={setPanel} />
      </div>
    </div>
  );
}

function renderGroup(rule: CombinedRule): string {
  if (rule.name === rule.group.name) {
    return rule.namespace.name;
  }
  return `${rule.namespace.name} / ${rule.group.name}`;
}

const getVizStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(2)};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius(1)};
      padding-bottom: ${theme.spacing(1)};
    `,
    header: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      border-radius: 2px;
      background: ${theme.v1.colors.bg2};
      min-height: ${theme.spacing(4)};
      display: flex;
      align-items: center;
      justify-content: space-between;
      white-space: nowrap;

      &:focus {
        outline: none;
      }
    `,
    content: css`
      padding: ${theme.spacing(2)};
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.link};
      margin-left: ${theme.spacing(2)};
      overflow: hidden;
    `,
    datasource: css`
      margin-left: ${theme.spacing(2)};
    `,
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      margin: ${theme.spacing(0, 2, 2)};
      padding: ${theme.spacing(2)};
    `,
    quickInfo: css`
      display: flex;
      justify-content: space-between;
    `,
    queries: css`
      width: 50%;
    `,
    query: css`
      height: 450px;
    `,
    info: css`
      max-width: ${theme.breakpoints.values.md}px;
    `,
    label: css`
      width: 110px;
      padding-right: ${theme.spacing(2)};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      line-height: 1.8;
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
