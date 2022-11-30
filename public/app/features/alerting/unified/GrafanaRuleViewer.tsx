import { css } from '@emotion/css';
import { dump } from 'js-yaml';
import { keyBy } from 'lodash';
import Prism from 'prismjs';
import React, { useEffect } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data/src';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime/src';
import { useStyles2 } from '@grafana/ui/src';
import { mapRelativeTimeRangeToOption } from '@grafana/ui/src/components/DateTimePickers/RelativeTimeRangePicker/utils';

import { AlertQuery, RulerGrafanaRuleDTO } from '../../../types/unified-alerting-dto';
import { isExpressionQuery } from '../../expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from '../../expressions/types';
import alertDef, { EvalFunction } from '../state/alertDef';

export function GrafanaRuleViewer({ rule }: { rule: RulerGrafanaRuleDTO }) {
  const styles = useStyles2(getGrafanaRuleViewerStyles);

  const dsByUid = keyBy(Object.values(config.datasources), (ds) => ds.uid);

  useEffect(() => {
    Prism.highlightAll();
  });

  return (
    <div>
      <h2>Grafana Rule Preview</h2>
      <Stack gap={2}>
        {rule.grafana_alert.data.map(({ model, relativeTimeRange, refId, datasourceUid }, index) => {
          const dataSource = dsByUid[datasourceUid];

          if (isExpressionQuery(model)) {
            return <ExpressionPreview key={index} refId={refId} model={model} dataSource={dataSource} />;
          }

          return (
            <QueryPreview
              key={index}
              refId={refId}
              model={model}
              relativeTimeRange={relativeTimeRange}
              dataSource={dataSource}
            />
          );
        })}
      </Stack>
    </div>
  );
}

const getGrafanaRuleViewerStyles = (theme: GrafanaTheme2) => ({});

interface QueryPreviewProps extends Pick<AlertQuery, 'refId' | 'relativeTimeRange' | 'model'> {
  dataSource?: DataSourceInstanceSettings;
}

function QueryPreview({ refId, relativeTimeRange, model, dataSource }: QueryPreviewProps) {
  const styles = useStyles2(getQueryPreviewStyles);

  const headerItems = [dataSource?.name ?? '[[Data source not found]]'];
  if (relativeTimeRange) {
    headerItems.push(mapRelativeTimeRangeToOption(relativeTimeRange).display);
  }

  return (
    <QueryBox refId={refId} headerItems={headerItems}>
      <pre>
        <code>{dump(model)}</code>
      </pre>
    </QueryBox>
  );
}

const getQueryPreviewStyles = (theme: GrafanaTheme2) => ({});

interface ExpressionPreviewProps extends Pick<AlertQuery, 'refId'> {
  model: ExpressionQuery;
  dataSource: DataSourceInstanceSettings;
}

function ExpressionPreview({ refId, model }: ExpressionPreviewProps) {
  function renderPreview() {
    switch (model.type) {
      case ExpressionQueryType.math:
        return <QueryBox refId={refId} headerItems={['Math']}></QueryBox>;

      case ExpressionQueryType.reduce:
        return <QueryBox refId={refId} headerItems={['Reduce']}></QueryBox>;

      case ExpressionQueryType.resample:
        return <QueryBox refId={refId} headerItems={['Resample']}></QueryBox>;

      case ExpressionQueryType.classic:
        return (
          <QueryBox refId={refId} headerItems={['Classic condition']}>
            <ClassicConditionViewer model={model} />
          </QueryBox>
        );

      case ExpressionQueryType.threshold:
        return <QueryBox refId={refId} headerItems={['Threshold']}></QueryBox>;

      default:
        return <>Expression not supported: {model.type}</>;
    }
  }

  return <div>{renderPreview()}</div>;
}

interface QueryBoxProps extends React.PropsWithChildren<unknown> {
  refId: string;
  headerItems?: string[];
}

function QueryBox({ refId, headerItems = [], children }: QueryBoxProps) {
  const styles = useStyles2(getQueryBoxStyles);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.refId}>{refId}</span>
        {headerItems.map((item, index) => (
          <span key={index} className={styles.textBlock}>
            {item}
          </span>
        ))}
      </header>
      {children}
    </div>
  );
}

const getQueryBoxStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border: 1px solid ${theme.colors.border.strong};
  `,
  header: css`
    display: flex;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
  `,
  textBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.primary};
  `,
  refId: css`
    color: ${theme.colors.text.link};
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
});

interface ClassicConditionViewerProps {
  model: ExpressionQuery;
}

function ClassicConditionViewer({ model }: ClassicConditionViewerProps) {
  const styles = useStyles2(getClassicConditionViewerStyles);

  const reducerFunctions = keyBy(alertDef.reducerTypes, (rt) => rt.value);
  const evalOperators = keyBy(alertDef.evalOperators, (eo) => eo.value);
  const evalFunctions = keyBy(alertDef.evalFunctions, (ef) => ef.value);

  return (
    <div className={styles.container}>
      {model.conditions?.map(({ query, operator, reducer, evaluator }, index) => {
        const isRange = evaluator.type === EvalFunction.IsWithinRange || evaluator.type === EvalFunction.IsOutsideRange;

        return (
          <React.Fragment key={index}>
            <div className={styles.operator}>
              {index === 0 ? 'WHEN' : !!operator?.type && evalOperators[operator?.type]?.text}
            </div>
            <div className={styles.reducer}>{reducer?.type && reducerFunctions[reducer.type]?.text}</div>
            <div className={styles.of}>OF</div>
            <div className={styles.query}>{query.params[0]}</div>
            <div className={styles.evaluator}>{evalFunctions[evaluator.type].text}</div>
            <div className={styles.evaluatorParam}>
              {isRange ? `(${evaluator.params[0]}; ${evaluator.params[1]})` : evaluator.params[0]}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const getClassicConditionViewerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    display: grid;
    grid-template-columns: max-content max-content max-content max-content max-content max-content;
    gap: ${theme.spacing(0, 1)};
  `,
  operator: css`
    color: ${theme.colors.text.link};
  `,
  reducer: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  of: css`
    color: ${theme.colors.text.link};
  `,
  query: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  evaluator: css`
    color: ${theme.colors.text.link};
  `,
  evaluatorParam: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
