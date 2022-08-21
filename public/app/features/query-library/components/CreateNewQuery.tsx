import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';

import { SavedQuery, useUpdateSavedQueryMutation } from '../api/SavedQueriesApi';

import { SavedQueryUpdateOpts } from './QueryEditorDrawer';

type Props = {
  options: SavedQueryUpdateOpts;
  onDismiss: () => void;
  updateComponent?: () => void;
};

interface QueryForm {
  val: SavedQuery;
}

const initialForm: QueryForm = {
  val: {
    title: 'ds-variables',
    tags: [],
    description: 'example description',
    schemaVersion: 1,
    time: {
      from: 'now-6h',
      to: 'now',
    },
    variables: [
      {
        name: 'var1',
        type: 'text',
        current: {
          value: 'hello world',
        },
      },
    ],
    queries: [
      {
        // @ts-ignore
        channel: 'plugin/testdata/random-flakey-stream',
        datasource: {
          type: 'datasource',
          uid: 'grafana',
        },
        filter: {
          fields: ['Time', 'Value'],
        },
        queryType: 'measurements',
        refId: 'A',
        search: {
          query: '',
        },
      },
      {
        // @ts-ignore
        alias: 'my-alias',
        datasource: {
          type: 'testdata',
          uid: 'PD8C576611E62080A',
        },
        drop: 11,
        hide: false,
        max: 1000,
        min: 10,
        noise: 5,
        refId: 'B',
        scenarioId: 'random_walk',
        startValue: 10,
      },
    ],
  },
};

export const CreateNewQuery = ({ onDismiss, updateComponent, options }: Props) => {
  const styles = useStyles2(getStyles);

  const [updateSavedQuery] = useUpdateSavedQueryMutation();

  const [query, setQuery] = useState(initialForm);

  return (
    <>
      <CodeEditor
        containerStyles={styles.editor}
        width="80%"
        height="70vh"
        language="json"
        showLineNumbers={false}
        showMiniMap={true}
        value={JSON.stringify(query.val, null, 2)}
        onBlur={(val) => setQuery(() => ({ val: JSON.parse(val) }))}
        onSave={(val) => setQuery(() => ({ val: JSON.parse(val) }))}
        readOnly={false}
      />

      <Button
        type="submit"
        className={styles.submitButton}
        onClick={async () => {
          await updateSavedQuery({ query: query.val, opts: options });
          onDismiss();
          updateComponent?.();
        }}
      >
        Save query
      </Button>
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    editor: css``,
    submitButton: css`
      align-self: flex-end;
      margin-bottom: 25px;
      margin-top: 25px;
    `,
  };
};
