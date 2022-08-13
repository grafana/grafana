import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { Alert, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';

import QueryLibrarySearchTable from './QueryLibrarySearchTable';

const node: NavModelItem = {
  id: 'query',
  text: 'Query Library',
  subTitle: 'Store, import, export and manage your team queries in an easy way.',
  icon: 'file-search-alt', // TODO: Fix this (currently not showing up??)
  url: 'query-library',
};

const QueryLibraryPage = () => {
  const styles = useStyles2(getStyles);

  if (!config.featureToggles.panelTitleSearch) {
    return <Alert title="Missing feature toggle: panelTitleSearch">Query library requires searchV2</Alert>;
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <div className={styles.tableWrapper}>
          <QueryLibrarySearchTable />
        </div>
      </Page.Contents>
    </Page>
  );
};

export default QueryLibraryPage;

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWrapper: css`
      height: 100%;
    `,
    table: css`
      width: 100%;
      height: 100%;
    `,
    createQueryButton: css`
      text-align: center;
    `,
  };
};
