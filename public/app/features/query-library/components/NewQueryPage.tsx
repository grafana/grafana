import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';

import { SavedQuery, useUpdateSavedQueryMutation } from '../api/SavedQueriesApi';

const node: NavModelItem = {
  id: 'new-query',
  text: 'Query Library - New Query',
  subTitle: 'Create new query.',
  icon: 'file-search-alt', // TODO: Fix this (currently not showing up??)
  url: 'query-library/new',
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

const NewQueryPage = () => {
  const styles = useStyles2(getStyles);

  const [updateSavedQuery] = useUpdateSavedQueryMutation();

  const [query, setQuery] = useState(initialForm);

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <div className={styles.header}>
          <h3>New Query </h3>
          <Button
            type="submit"
            className={styles.submitButton}
            onClick={async () => {
              await updateSavedQuery(query.val);
              locationService.push('/query-library');
            }}
          >
            Create
          </Button>
        </div>
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
      </Page.Contents>
    </Page>
  );
};

export default NewQueryPage;

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    editor: css``,
    submitButton: css`
      width: 75px;
      align-self: flex-end;
      margin-bottom: 15px;
    `,
    header: css`
      width: 80%;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
  };
};
