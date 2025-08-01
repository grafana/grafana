import { css } from '@emotion/css';
import { useMemo, useRef, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { SQLEditor, CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/plugin-ui';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { useStyles2 } from '@grafana/ui';

import { SqlExpressionQuery } from '../types';
import { fetchSQLFields } from '../utils/metaSqlExpr';

import { getSqlCompletionProvider } from './sqlCompletionProvider';

// Account for Monaco editor's border to prevent clipping
const EDITOR_BORDER_ADJUSTMENT = 2; // 1px border on top and bottom

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: SqlExpressionQuery;
  queries: DataQuery[] | undefined;
  onChange: (query: SqlExpressionQuery) => void;
  /** Should the `format` property be set to `alerting`? */
  alerting?: boolean;
}

export const SqlExpr = ({ onChange, refIds, query, alerting = false, queries }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const completionProvider = useMemo(
    () =>
      getSqlCompletionProvider({
        getFields: (identifier: TableIdentifier) => fetchFields(identifier, queries || []),
        refIds,
      }),
    [queries, refIds]
  );

  // Define the language definition for MySQL syntax highlighting and autocomplete
  const EDITOR_LANGUAGE_DEFINITION: LanguageDefinition = {
    id: 'mysql',
    completionProvider,
  };

  const initialQuery = `SELECT *
  FROM ${vars[0]}
  LIMIT 10`;

  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0 });

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
      format: alerting ? 'alerting' : undefined,
    });
  };

  // Set up resize observer to handle container resizing
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const { height } = entries[0].contentRect;
      setDimensions({ height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    // Call the onChange method once so we have access to the initial query in consuming components
    // But only if expression is empty
    if (!query.expression) {
      onEditorChange(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={styles.editorContainer}>
      <SQLEditor
        query={query.expression || initialQuery}
        onChange={onEditorChange}
        height={dimensions.height - EDITOR_BORDER_ADJUSTMENT}
        language={EDITOR_LANGUAGE_DEFINITION}
      />
    </div>
  );
};

const getStyles = () => ({
  editorContainer: css({
    height: '240px',
    resize: 'vertical',
    overflow: 'auto',
    minHeight: '100px',
  }),
});

async function fetchFields(identifier: TableIdentifier, queries: DataQuery[]) {
  const fields = await fetchSQLFields({ table: identifier.table }, queries);
  return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
}
