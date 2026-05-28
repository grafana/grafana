import { css } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';

import { CoreApp, type GrafanaTheme2, type QueryEditorProps } from '@grafana/data';
import {
  EditorHeader,
  EditorRows,
  FlexItem,
  QueryEditorMode,
  QueryHeaderSwitch,
} from '@grafana/plugin-ui';
import {
  PromQueryBuilderContainer,
  PromQueryBuilderOptions,
  PromQueryCodeEditor,
  PromQueryEditorByApp,
  type PromOptions,
  type PromQuery,
  PrometheusDatasource,
} from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import { Button, RadioButtonGroup, Space, useStyles2 } from '@grafana/ui';

import { SqlEditor } from 'app/features/dashboard-scene/sql-workbench/SqlEditor';
import { OPEN_IN_WORKBENCH_EVENT, setPendingWorkbenchSql } from 'app/features/dashboard-scene/sql-workbench/workbenchStore';

type PromQueryEditorProps = QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions>;
type InlineQueryMode = 'builder' | 'native' | 'sql';

const MODE_OPTIONS: Array<{ label: string; value: InlineQueryMode }> = [
  { label: 'Builder', value: 'builder' },
  { label: 'Native code', value: 'native' },
  { label: 'SQL code', value: 'sql' },
];

function exprToSql(expr: string): string {
  if (!expr.trim()) {
    return `SELECT\n  native(/* add PromQL here */)\n    AS value\nFROM prometheus`;
  }

  // Decompose: sum by (cols) (rate(metric{filters}[range]))
  const sumByRate = expr.trim().match(
    /^sum\s+by\s*\(([^)]+)\)\s*\(\s*rate\s*\(\s*([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\{([^}]*)\}\s*(\[[^\]]+\])\s*\)\s*\)$/
  );

  if (sumByRate) {
    const [, groupByRaw, metric, filtersRaw, range] = sumByRate;
    const groupByCols = groupByRaw.split(',').map((s) => s.trim()).filter(Boolean);

    // Convert PromQL label matchers to SQL WHERE conditions
    const whereConditions = filtersRaw
      .split(',')
      .map((f) => {
        const eq = f.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"$/);
        if (eq) { return `${eq[1]} = '${eq[2]}'`; }
        const neq = f.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*!=\s*"([^"]*)"$/);
        if (neq) { return `${neq[1]} != '${neq[2]}'`; }
        return f.trim();
      })
      .filter(Boolean);

    const selectCols = groupByCols.map((col) => `  ${col},`).join('\n');

    return [
      `SELECT`,
      selectCols,
      `  native(`,
      `    sum by (${groupByRaw.trim()}) (`,
      `      rate(${metric}{${filtersRaw}}${range})`,
      `    )`,
      `  ) AS requests_per_second`,
      `FROM ${metric}`,
      `WHERE ${whereConditions.join('\n  AND ')}`,
      `GROUP BY ${groupByCols.join(', ')}`,
    ].join('\n');
  }

  return `SELECT\n  native(${expr})\n    AS value\nFROM prometheus`;
}

function sqlToExpr(sql: string): string {
  const match = sql.match(/native\s*\((.+)\)/s);
  return match ? match[1].trim() : '';
}

function initialMode(query: PromQuery): InlineQueryMode {
  return query.editorMode === QueryEditorMode.Code ? 'native' : 'builder';
}

export function PromQueryEditorWithSqlMode(props: PromQueryEditorProps) {
  if (!config.featureToggles.sqlAbstractionPrototype || props.app === CoreApp.CloudAlerting) {
    return <PromQueryEditorByApp {...props} />;
  }
  return <PromQueryEditorSqlModeInner {...props} />;
}

function PromQueryEditorSqlModeInner(props: PromQueryEditorProps) {
  const { query, onChange, onRunQuery, datasource, data, app } = props;
  const styles = useStyles2(getStyles);

  const [queryMode, setQueryMode] = useState<InlineQueryMode>(() => initialMode(query));
  const [sqlText, setSqlText] = useState<string>(() => exprToSql(query.expr ?? ''));
  const [explain, setExplain] = useState(false);

  // Track the latest expr via a ref so handleModeChange always reads the current
  // value even if the PromQL Monaco field's onBlur fires at the same time as the
  // mode-switch click (before React has re-rendered with the new query prop).
  const latestExprRef = useRef(query.expr ?? '');

  const handleNativeChange = useCallback(
    (updatedQuery: PromQuery) => {
      latestExprRef.current = updatedQuery.expr ?? '';
      onChange(updatedQuery);
    },
    [onChange]
  );

  const queryForBuilder: PromQuery = { ...query, editorMode: QueryEditorMode.Builder };
  const queryForNative: PromQuery = { ...query, editorMode: QueryEditorMode.Code };

  const handleModeChange = useCallback(
    (newMode: InlineQueryMode) => {
      if (newMode === queryMode) {
        return;
      }
      if (newMode === 'sql') {
        setSqlText(exprToSql(latestExprRef.current));
      } else if (queryMode === 'sql') {
        const expr = sqlToExpr(sqlText);
        onChange({
          ...query,
          expr,
          editorMode: newMode === 'native' ? QueryEditorMode.Code : QueryEditorMode.Builder,
        });
      } else {
        onChange({
          ...query,
          editorMode: newMode === 'native' ? QueryEditorMode.Code : QueryEditorMode.Builder,
        });
      }
      setQueryMode(newMode);
    },
    [queryMode, query, sqlText, onChange]
  );

  const handleOpenInWorkbench = useCallback(() => {
    setPendingWorkbenchSql(sqlText);
    window.dispatchEvent(new CustomEvent(OPEN_IN_WORKBENCH_EVENT));
  }, [sqlText]);

  return (
    <>
      <EditorHeader>
        <QueryHeaderSwitch
          label="Explain"
          value={explain}
          onChange={(e) => setExplain(e.currentTarget.checked)}
        />
        <FlexItem grow={1} />
        {queryMode === 'sql' && (
          <Button variant="secondary" size="sm" onClick={handleOpenInWorkbench}>
            Open in workbench
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onRunQuery}>
          Run queries
        </Button>
        <RadioButtonGroup options={MODE_OPTIONS} value={queryMode} onChange={handleModeChange} size="sm" />
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {queryMode === 'builder' && (
          <PromQueryBuilderContainer
            query={queryForBuilder}
            datasource={datasource}
            onChange={onChange}
            onRunQuery={onRunQuery}
            data={data}
            showExplain={explain}
          />
        )}
        {queryMode === 'native' && (
          <PromQueryCodeEditor {...props} query={queryForNative} onChange={handleNativeChange} showExplain={explain} />
        )}
        {queryMode === 'sql' && (
          <div className={styles.sqlEditorWrap}>
            <SqlEditor value={sqlText} onChange={setSqlText} onRunQuery={onRunQuery} />
          </div>
        )}
        {queryMode !== 'sql' && (
          <PromQueryBuilderOptions query={query} app={app} onChange={onChange} onRunQuery={onRunQuery} />
        )}
      </EditorRows>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sqlEditorWrap: css({
      height: 200,
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
  };
}
