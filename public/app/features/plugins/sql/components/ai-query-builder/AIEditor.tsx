/* eslint-disable react-hooks/exhaustive-deps */

/*
ESLINT (useEffect bypass):
i only want to update the query when the response changes.
eslint doesn't like this, and wants me to add "onChange" and "query" to the dependency array.\this causes an infinite loop, so i'm disabling it.
*/

import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorRow, EditorRows } from '@grafana/experimental';
import { Button, CodeEditor, Field, Icon, MultiSelect, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { MonacoOptionsWithGrafanaDefaults } from '@grafana/ui/src/components/Monaco/types';

import { SqlDatasource } from '../../datasource/SqlDatasource';
import { DB, SQLQuery } from '../../types';

import { requestAI } from './helpers';

interface AIEditorProps {
  datasource: SqlDatasource;
  db: DB;
  query: SQLQuery;
  onChange: (q: SQLQuery, processQuery: boolean) => void;
}

export const AIEditor = ({ datasource, db, query, onChange }: AIEditorProps) => {
  const styles = useStyles2(getStyles);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const [tables, setTables] = useState<any[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedTables, setSelectedTables] = useState<any[]>([]);
  const [showCopySuccess, setShowCopySuccess] = useState<boolean>(false);
  const [showErrorMessage, setShowErrorMessage] = useState<boolean>(false);
  const [response, setResponse] = useState<string>('');
  const [_, copyToClipboard] = useCopyToClipboard();

  const onMakeRequest = async () => {
    if (!prompt || !selectedTables.length) {
      setShowErrorMessage(true);
      return;
    }

    const response = await requestAI(datasource.meta.name, db, prompt, selectedTables);
    setResponse(response);
  };

  const onCopyResponse = () => {
    copyToClipboard(response);
    setShowCopySuccess(true);
    setTimeout(() => {
      setShowCopySuccess(false);
    }, 2500);
  };

  useEffect(() => {
    (async () => {
      setTables(await transformTables(db));
    })();
  }, [db]);

  useEffect(() => {
    if (prompt && selectedTables.length) {
      setShowErrorMessage(false);
    }
  }, [prompt, selectedTables]);

  useEffect(() => {
    onChange({ ...query, rawQuery: true, rawSql: response }, false);
  }, [response]);

  return (
    <EditorRows>
      <EditorRow>
        <Stack gap={1.5} direction="column">
          <EditorField label="Prompt" width={100} required>
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder="Retrieve all data points with a value greater than 50"
            />
          </EditorField>
          <EditorField label="Select tables" width={100} required>
            <MultiSelect options={tables} onChange={(e) => setSelectedTables(e)} />
          </EditorField>
          <Stack gap={1} direction="row">
            <Button size="sm" variant="primary" onClick={onMakeRequest}>
              Ask AI
            </Button>
            <Button
              ref={btnRef}
              size="sm"
              variant="secondary"
              onClick={onCopyResponse}
              disabled={!response}
              tooltip={'Copy the AI generated query to clipboard'}
            >
              Copy to clipboard
            </Button>
            {showCopySuccess && (
              <p className={styles.success}>
                <Icon name="check" /> Response has been copied to clipboard.
              </p>
            )}
            {showErrorMessage && (
              <p className={styles.error}>
                Submitting a request requires both a prompt and the selection of at least one table.
              </p>
            )}
          </Stack>
        </Stack>
      </EditorRow>

      <EditorRow>
        <Field label={'AI generated query'} className={styles.preview}>
          <CodeEditor
            readOnly={true}
            language="sql"
            height={150}
            value={response || ''}
            monacoOptions={getMonacoOptions()}
          />
        </Field>
      </EditorRow>
    </EditorRows>
  );
};

const transformTables = async (db: DB) => {
  const tables = await db.tables();
  return tables.map((table) => {
    return { label: table, value: table };
  });
};

const getMonacoOptions = (): MonacoOptionsWithGrafanaDefaults => {
  return {
    scrollbar: { vertical: 'hidden' },
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    preview: css`
      flex-grow: 1;
    `,
    success: css`
      margin: 0px;
      align-self: center;
      color: ${theme.colors.success.text};
      font-size: ${theme.typography.size.sm};
    `,
    error: css`
      margin: 0px;
      align-self: center;
      color: ${theme.colors.error.text};
      font-size: ${theme.typography.size.sm};
    `,
  };
};
