import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Modal, useStyles2, useTheme2 } from '@grafana/ui';

import { SQLQuery, QueryEditorProps } from '../../types';

import { QueryEditorRaw } from './QueryEditorRaw';
import { QueryToolbox } from './QueryToolbox';

interface RawEditorProps extends Omit<QueryEditorProps, 'onChange'> {
  onRunQuery: () => void;
  onChange: (q: SQLQuery, processQuery: boolean) => void;
  onValidate: (isValid: boolean) => void;
  queryToValidate: SQLQuery;
}

export function RawEditor({ db, query, onChange, onRunQuery, onValidate, queryToValidate, range }: RawEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [editorRef, editorMeasure] = useMeasure<HTMLDivElement>();

  const editorLanguageDefinition = useMemo(() => db.getEditorLanguageDefinition(), [db]);

  const renderQueryEditor = (width?: number, height?: number) => {
    return (
      <QueryEditorRaw
        editorLanguageDefinition={editorLanguageDefinition}
        query={query}
        width={width}
        height={height ? height - toolboxMeasure.height : undefined}
        onChange={onChange}
      >
        {({ formatQuery }) => {
          return (
            <div ref={toolboxRef}>
              <QueryToolbox
                db={db}
                query={queryToValidate}
                onValidate={onValidate}
                onFormatCode={formatQuery}
                showTools
                range={range}
                onExpand={setIsExpanded}
                isExpanded={isExpanded}
              />
            </div>
          );
        }}
      </QueryEditorRaw>
    );
  };

  const renderEditor = (standalone = false) => {
    return standalone ? (
      <AutoSizer>
        {({ width, height }) => {
          return renderQueryEditor(width, height);
        }}
      </AutoSizer>
    ) : (
      <div ref={editorRef}>{renderQueryEditor()}</div>
    );
  };

  const renderPlaceholder = () => {
    return (
      <div
        style={{
          width: editorMeasure.width,
          height: editorMeasure.height,
          background: theme.colors.background.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trans i18nKey="grafana-sql.components.raw-editor.render-placeholder.editing-in-expanded-code-editor">
          Editing in expanded code editor
        </Trans>
      </div>
    );
  };

  return (
    <>
      {isExpanded ? renderPlaceholder() : renderEditor()}
      {isExpanded && (
        <Modal
          title={t('grafana-sql.components.raw-editor.title-query-num', 'Query {{queryNum}}', {
            queryNum: query.refId,
          })}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          className={styles.modal}
          contentClassName={styles.modalContent}
          isOpen={isExpanded}
          onDismiss={() => {
            reportInteraction('grafana_sql_editor_expand', {
              datasource: query.datasource?.type,
              expanded: false,
            });
            setIsExpanded(false);
          }}
        >
          {renderEditor(true)}
        </Modal>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '95vw',
      height: '95vh',
    }),
    modalContent: css({
      height: '100%',
      paddingTop: 0,
    }),
  };
}
