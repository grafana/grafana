import React from 'react';

import { NavModelItem } from '@grafana/data';
// import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';

const node: NavModelItem = {
  id: 'query',
  text: 'Query Library',
  subTitle: 'Store, import, export and manage your team queries in easy way.',
  icon: 'file-search-alt', // TODO: Fix this (currently not showing up??)
  url: 'query-library',
};

const QueryLibraryPage = () => {
  //   const styles = useStyles2(getStyles);

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <div>HIQ</div>
      </Page.Contents>
    </Page>
  );
};

// const getStyles = (theme: GrafanaTheme2) => ({});

export default QueryLibraryPage;
