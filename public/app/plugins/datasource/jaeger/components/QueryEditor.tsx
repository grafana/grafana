import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type QueryEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Button,
  FileDropzone,
  InlineField,
  InlineFieldRow,
  Stack,
  Modal,
  RadioButtonGroup,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { CodeMirrorEditor, getQueryFieldConfig } from '@grafana/ui/unstable';

import { type JaegerDatasource } from '../datasource';
import { type JaegerQuery, type JaegerQueryType } from '../types';

import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

function TraceIdEditor({ query, onChange, onRunQuery }: Pick<Props, 'query' | 'onChange' | 'onRunQuery'>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const queryRef = useRef(query);
  queryRef.current = query;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRunQueryRef = useRef(onRunQuery);
  onRunQueryRef.current = onRunQuery;

  // The editor text and the text of the last run, so blur only re-runs when
  // something actually changed.
  const textRef = useRef(query.query ?? '');
  const lastExecutedRef = useRef(query.query ?? '');
  // The last value we propagated upstream, used to tell our own change echoing
  // back through `query.query` apart from a genuinely external replacement.
  const lastPropagatedRef = useRef(query.query ?? '');

  // Debounce change propagation for perf, like the Slate query field did.
  const updateQuery = useMemo(
    () =>
      debounce((value: string) => {
        lastPropagatedRef.current = value;
        onChangeRef.current({ ...queryRef.current, query: value });
      }, 500),
    []
  );

  // Drop any pending edit on unmount. User-driven unmounts (e.g. clicking the
  // Search query type) blur the editor first, which flushes the edit while the
  // query prop is still current — so a pending edit here means the unmount was
  // externally driven, and flushing would spread a stale query object over the
  // external change.
  useEffect(() => () => updateQuery.cancel(), [updateQuery]);

  // Reconcile genuinely external query changes (query history, correlations,
  // variable/URL updates) — but ignore the echo of our own debounced change.
  useEffect(() => {
    const incoming = query.query ?? '';
    if (incoming === lastPropagatedRef.current) {
      return;
    }
    textRef.current = incoming;
    // An external change is not a local edit: reset the run baseline so a blur
    // without edits doesn't re-run, and drop any pending edit that would
    // otherwise overwrite the new value.
    lastExecutedRef.current = incoming;
    lastPropagatedRef.current = incoming;
    updateQuery.cancel();
  }, [query.query, updateQuery]);

  const handleChange = useCallback(
    (value: string) => {
      textRef.current = value;
      updateQuery(value);
    },
    [updateQuery]
  );

  const runQuery = useCallback(() => {
    // Push any pending edit into the query first so the executed query matches
    // what was typed.
    updateQuery.flush();
    lastExecutedRef.current = textRef.current;
    onRunQueryRef.current();
  }, [updateQuery]);

  const handleBlur = useCallback(() => {
    // Dashboard panels expect the query to run on blur, but only re-run when
    // the trace ID changed since the last run.
    updateQuery.flush();
    if (textRef.current !== lastExecutedRef.current) {
      lastExecutedRef.current = textRef.current;
      onRunQueryRef.current();
    }
  }, [updateQuery]);

  const config = useMemo(
    () =>
      getQueryFieldConfig(theme, {
        placeholder: 'Enter a Trace ID (run with Shift+Enter)',
        onRunQuery: runQuery,
        onBlur: handleBlur,
      }),
    [theme, runQuery, handleBlur]
  );

  return (
    <div className={styles.traceIdEditor} data-testid={selectors.components.QueryField.container}>
      <CodeMirrorEditor
        value={query.query ?? ''}
        onChange={handleChange}
        height="auto"
        indentWithTab={false}
        aria-label="Trace ID"
        {...config}
      />
    </div>
  );
}

export function QueryEditor({ datasource, query, onChange, onRunQuery }: Props) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const renderEditorBody = () => {
    switch (query.queryType) {
      case 'search':
        return <SearchForm datasource={datasource} query={query} onChange={onChange} />;
      case 'dependencyGraph':
        return null;
      default:
        return (
          <InlineFieldRow>
            <InlineField label="Trace ID" labelWidth={14} grow>
              <TraceIdEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />
            </InlineField>
          </InlineFieldRow>
        );
    }
  };

  return (
    <>
      <Modal title={'Upload trace'} isOpen={uploadModalOpen} onDismiss={() => setUploadModalOpen(false)}>
        <div className={css({ padding: theme.spacing(2) })}>
          <FileDropzone
            options={{ multiple: false }}
            onLoad={(result) => {
              datasource.uploadedJson = result;
              onChange({
                ...query,
                queryType: 'upload',
              });
              setUploadModalOpen(false);
              onRunQuery();
            }}
          />
        </div>
      </Modal>
      <div className={styles.container}>
        <InlineFieldRow>
          <InlineField label="Query type" grow={true}>
            <Stack gap={1} alignItems="center" justifyContent="space-between">
              <RadioButtonGroup<JaegerQueryType>
                options={[
                  { value: 'search', label: 'Search' },
                  { value: undefined, label: 'TraceID' },
                  { value: 'dependencyGraph', label: 'Dependency graph' },
                ]}
                value={query.queryType}
                onChange={(v) =>
                  onChange({
                    ...query,
                    queryType: v,
                  })
                }
                size="md"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setUploadModalOpen(true);
                }}
              >
                Import trace
              </Button>
            </Stack>
          </InlineField>
        </InlineFieldRow>
        {renderEditorBody()}
      </div>
    </>
  );
}

const getStyles = () => ({
  container: css({
    width: '100%',
  }),
  traceIdEditor: css({
    width: '100%',
  }),
});
