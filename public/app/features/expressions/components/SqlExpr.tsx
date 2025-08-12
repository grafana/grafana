import { css } from '@emotion/css';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SQLEditor, CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/plugin-ui';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { formatSQL } from '@grafana/sql';
import { Button, Modal, Stack, useStyles2 } from '@grafana/ui';

import { SqlExpressionQuery } from '../types';
import { fetchSQLFields } from '../utils/metaSqlExpr';

import { QueryToolbox } from './QueryToolbox';
import { getSqlCompletionProvider } from './sqlCompletionProvider';

// Account for Monaco editor's border to prevent clipping
const EDITOR_BORDER_ADJUSTMENT = 2; // 1px border on top and bottom

interface SqlExprProps {
  refIds: Array<SelectableValue<string>>;
  query: SqlExpressionQuery;
  queries: DataQuery[] | undefined;
  onChange: (query: SqlExpressionQuery) => void;
  onRunQuery?: () => void;
  /** Should the `format` property be set to `alerting`? */
  alerting?: boolean;
}

export const SqlExpr = ({ onChange, refIds, query, alerting = false, queries, onRunQuery }: SqlExprProps) => {
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
    formatter: formatSQL,
  };

  const initialQuery = `SELECT
  *
FROM
  ${vars[0]}
LIMIT
  10`;

  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0 });
  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [isExpanded, setIsExpanded] = useState(false);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
      format: alerting ? 'alerting' : undefined,
    });
  };

  const executeQuery = useCallback(() => {
    if (query.expression && onRunQuery) {
      onRunQuery();
    }
  }, [query.expression, onRunQuery]);

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

  // cmd/ctrl + enter to run query
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes('Mac');
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (isCmdOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        executeQuery();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [executeQuery]);

  const renderToolbox = (formatQuery: () => void) => (
    <div ref={toolboxRef}>
      <QueryToolbox query={query} onFormatCode={formatQuery} onExpand={setIsExpanded} isExpanded={isExpanded} />
    </div>
  );

  const renderSQLEditor = (width?: number, height?: number) => (
    <SQLEditor
      query={query.expression || initialQuery}
      onChange={onEditorChange}
      width={width}
      height={height ?? dimensions.height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height}
      language={EDITOR_LANGUAGE_DEFINITION}
    >
      {({ formatQuery }) => renderToolbox(formatQuery)}
    </SQLEditor>
  );

  const renderStandaloneEditor = () => (
    <AutoSizer>
      {({ width, height }) =>
        renderSQLEditor(width, height ? height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height : undefined)
      }
    </AutoSizer>
  );

  return (
    <>
      <Stack direction="column" gap={1.5}>
        <div className={styles.sqlButtons}>
          <Button icon="play" onClick={executeQuery} size="sm">
            {t('expressions.sql-expr.button-run-query', 'Run query')}
          </Button>
        </div>
      </Stack>
      <div ref={containerRef} className={styles.editorContainer}>
        {renderSQLEditor()}
        {isExpanded && (
          <Modal
            title={t('expressions.sql-expr.modal-title', 'SQL Editor')}
            closeOnBackdropClick={false}
            closeOnEscape={false}
            className={styles.modal}
            contentClassName={styles.modalContent}
            isOpen={isExpanded}
            onDismiss={() => setIsExpanded(false)}
          >
            {renderStandaloneEditor()}
          </Modal>
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorContainer: css({
    height: '180px',
    width: '100%',
    resize: 'vertical',
    overflow: 'auto',
    minHeight: '100px',
  }),
  modal: css({
    width: '95vw',
    height: '95vh',
  }),
  modalContent: css({
    height: '100%',
    paddingTop: 0,
  }),
  sqlButtons: css({
    // This is NOT ideal. The alternative is to expose SQL buttons as a separate component,
    // Then consume them in ExpressionQueryEditor. This requires a lot of refactoring and
    // can be prioritized later.
    marginTop: theme.spacing(-4),
    gap: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  }),
});

async function fetchFields(identifier: TableIdentifier, queries: DataQuery[]) {
  const fields = await fetchSQLFields({ table: identifier.table }, queries);
  return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
}
