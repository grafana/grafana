import { DataQuery, NavModelItem } from '@grafana/data';
import { Button } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import React, { FC, useState } from 'react';
import { QueryEditorRenderer } from '../query/components/QueryEditorRenderer/QueryEditorRenderer';

const node: NavModelItem = {
  id: 'test-page',
  text: 'Test page',
  icon: 'dashboard',
  subTitle: 'FOR TESTING!',
  url: 'sandbox/test',
};

const testds = '000000001';
const mysql = '000000019';

type handlers = {
  onChange: (query: DataQuery) => void;
};

export const TestStuffPage: FC = () => {
  const [query, setQuery] = useState<DataQuery>({ refId: 'A', hide: false });
  const [dataSource, setDataSource] = useState<string>(mysql);
  const [handlers, setHandlers] = useState<handlers>({
    onChange: (query) => {
      console.log('query', query);
      setQuery(query);
    },
  });

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Button
          type="button"
          onClick={() => {
            if (dataSource === testds) {
              return setDataSource(mysql);
            }
            return setDataSource(testds);
          }}
        >
          Toggle datasource
        </Button>
        <Button
          type="button"
          onClick={() => {
            const now = Date.now();

            setHandlers({
              onChange: (query) => {
                console.log('query', query);
                console.log('rev', now);
                setQuery(query);
              },
            });
          }}
        >
          Update onChange
        </Button>
        <hr />
        <div>
          <QueryEditorRenderer
            nameOrUid={dataSource}
            onChange={handlers.onChange}
            onRunQuery={() => console.log('onRunQuery')}
            query={query}
            queries={[query]}
          />
        </div>
      </Page.Contents>
    </Page>
  );
};

export default TestStuffPage;
