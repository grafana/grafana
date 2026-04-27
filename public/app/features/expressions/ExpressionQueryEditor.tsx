import { css } from '@emotion/css';
import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { type DataSourceApi, FeatureState, type QueryEditorProps } from '@grafana/data/types';
import { t, Trans } from '@grafana/i18n';
import { Button, FeatureBadge, IconButton, InlineField, type PopoverContent } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { ClassicConditions } from './components/ClassicConditions';
import { ExpressionTypeDropdown } from './components/ExpressionTypeDropdown';
import { Math } from './components/Math';
import { Reduce } from './components/Reduce';
import { Resample } from './components/Resample';
import { Threshold } from './components/Threshold';
import { type ExpressionQuery, ExpressionQueryType, expressionTypes } from './types';
import { getDefaults } from './utils/expressionTypes';

export type ExpressionQueryEditorProps = QueryEditorProps<DataSourceApi<ExpressionQuery>, ExpressionQuery>;

const labelWidth = 15;
const SqlExpr = lazy(() =>
  import('./components/SqlExpressions/SqlExpr').then((module) => ({
    default: module.SqlExpr,
  }))
);

type NonClassicExpressionType = Exclude<ExpressionQueryType, ExpressionQueryType.classic>;
type ExpressionTypeConfigStorage = Partial<Record<NonClassicExpressionType, string>>;

/**
 * Get the configuration for an expression type (helper text and feature state).
 * @param type - The expression type.
 * @returns The configuration for the expression type.
 */
const getExpressionTypeConfig = (
  type: ExpressionQueryType
): { helperText: PopoverContent; featureState: FeatureState | undefined } => {
  const description = expressionTypes.find(({ value }) => value === type)?.description;

  switch (type) {
    case ExpressionQueryType.sql:
      return {
        helperText: (
          <Trans i18nKey="expressions.expression-query-editor.helper-text-sql">
            Run MySQL-dialect SQL against the tables returned from your data sources. Data source queries (ie
            &quot;A&quot;, &quot;B&quot;) are available as tables and referenced by query-name. Fields are available as
            columns, as returned from the data source.
          </Trans>
        ),
        featureState: FeatureState.preview,
      };
    default:
      return {
        helperText: description ?? '',
        featureState: undefined,
      };
  }
};

function useExpressionsCache() {
  const expressionCache = useRef<ExpressionTypeConfigStorage>({});

  const getCachedExpression = useCallback((queryType: ExpressionQueryType) => {
    switch (queryType) {
      case ExpressionQueryType.math:
      case ExpressionQueryType.reduce:
      case ExpressionQueryType.resample:
      case ExpressionQueryType.threshold:
      case ExpressionQueryType.sql:
        return expressionCache.current[queryType];
      case ExpressionQueryType.classic:
        return undefined;
    }
  }, []);

  const setCachedExpression = useCallback((queryType: ExpressionQueryType, value: string | undefined) => {
    switch (queryType) {
      case ExpressionQueryType.math:
        expressionCache.current.math = value;
        break;

      // We want to use the same value for Reduce, Resample and Threshold
      case ExpressionQueryType.reduce:
      case ExpressionQueryType.resample:
      case ExpressionQueryType.threshold:
        expressionCache.current.reduce = value;
        expressionCache.current.resample = value;
        expressionCache.current.threshold = value;
        break;
      case ExpressionQueryType.sql:
        expressionCache.current.sql = value;
    }
  }, []);

  return { getCachedExpression, setCachedExpression };
}

export function ExpressionQueryEditor(props: ExpressionQueryEditorProps) {
  const { query, queries, onRunQuery, onChange, app } = props;
  const { getCachedExpression, setCachedExpression } = useExpressionsCache();

  const styles = useStyles2(getStyles);

  useEffect(() => {
    setCachedExpression(query.type, query.expression);
  }, [query.expression, query.type, setCachedExpression]);

  const onSelectExpressionType = useCallback(
    (value: ExpressionQueryType) => {
      const cachedExpression = getCachedExpression(value!);
      const defaults = getDefaults({ ...query, type: value! });

      onChange({ ...defaults, expression: cachedExpression ?? defaults.expression });
    },
    [query, onChange, getCachedExpression]
  );

  const renderExpressionType = () => {
    const refIds = queries!.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));

    switch (query.type) {
      case ExpressionQueryType.math:
        return <Math onChange={onChange} query={query} labelWidth={labelWidth} onRunQuery={onRunQuery} />;

      case ExpressionQueryType.reduce:
        return <Reduce refIds={refIds} onChange={onChange} labelWidth={labelWidth} query={query} app={app} />;

      case ExpressionQueryType.resample:
        return <Resample query={query} labelWidth={labelWidth} onChange={onChange} refIds={refIds} />;

      case ExpressionQueryType.classic:
        return <ClassicConditions onChange={onChange} query={query} refIds={refIds} />;

      case ExpressionQueryType.threshold:
        return <Threshold onChange={onChange} query={query} labelWidth={labelWidth} refIds={refIds} />;

      case ExpressionQueryType.sql:
        return (
          <Suspense fallback={null}>
            <SqlExpr
              onChange={onChange}
              query={query}
              refIds={refIds}
              queries={queries}
              metadata={props}
              onRunQuery={onRunQuery}
            />
          </Suspense>
        );
    }
  };

  const { helperText, featureState } = getExpressionTypeConfig(query.type);

  return (
    <div>
      <div className={styles.operationRow}>
        <InlineField
          label={t('expressions.expression-query-editor.label-operation', 'Operation')}
          labelWidth={labelWidth}
        >
          <ExpressionTypeDropdown handleOnSelect={onSelectExpressionType}>
            <Button fill="outline" icon="angle-down" iconPlacement="right" variant="secondary">
              {expressionTypes.find(({ value }) => value === query.type)?.label}
            </Button>
          </ExpressionTypeDropdown>
        </InlineField>
        <div className={styles.fieldContainer}>
          {featureState && <FeatureBadge featureState={featureState} />}
          {helperText && <IconButton name="info-circle" tooltip={helperText} />}
        </div>
      </div>
      {renderExpressionType()}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  operationRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  fieldContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5), // Align with the select field
  }),
});
