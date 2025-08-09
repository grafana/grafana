import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';

import { DataSourceApi, GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, InlineField, PopoverContent, useStyles2 } from '@grafana/ui';

import { ClassicConditions } from './components/ClassicConditions';
import { ExpressionTypeDropdown } from './components/ExpressionTypeDropdown';
import { Math } from './components/Math';
import { Reduce } from './components/Reduce';
import { Resample } from './components/Resample';
import { SqlExpr } from './components/SqlExpr';
import { Threshold } from './components/Threshold';
import { ExpressionQuery, ExpressionQueryType, expressionTypes } from './types';
import { getDefaults } from './utils/expressionTypes';

type Props = QueryEditorProps<DataSourceApi<ExpressionQuery>, ExpressionQuery>;

const labelWidth = 15;

type NonClassicExpressionType = Exclude<ExpressionQueryType, ExpressionQueryType.classic>;
type ExpressionTypeConfigStorage = Partial<Record<NonClassicExpressionType, string>>;

// Help text for each expression type - can be expanded with more detailed content
const getExpressionHelpText = (type: ExpressionQueryType): PopoverContent | string => {
  const description = expressionTypes.find(({ value }) => value === type)?.description;

  switch (type) {
    case ExpressionQueryType.sql:
      return (
        <Trans i18nKey="expressions.expression-query-editor.helper-text-sql">
          Run MySQL-dialect SQL against the tables returned from your data sources. Data source queries (ie "A", "B")
          are available as tables and referenced by query-name. Fields are available as columns, as returned from the
          data source.
        </Trans>
      );
    default:
      return description ?? '';
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

export function ExpressionQueryEditor(props: Props) {
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
        return <SqlExpr onChange={onChange} query={query} refIds={refIds} queries={queries} onRunQuery={onRunQuery} />;
    }
  };

  const helperText = getExpressionHelpText(query.type);

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
        {helperText && <IconButton className={styles.infoIcon} name="info-circle" tooltip={helperText} />}
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
  infoIcon: css({
    marginBottom: theme.spacing(0.5), // Align with the select field
  }),
});
