import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { FileBrowser } from './FileBrowser';

export default function StoragePage() {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const [searchQuery, setSearchQuery] = useState('');
  const [path, setPath] = useState('');

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div className={styles.toolbar}>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or type" width={50} />
        </div>

        <div className={styles.border}>
          <FileBrowser path={path} onPathChange={setPath} />
          TODO: upload to this folder....
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: ${theme.spacing(2)};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
  modalBody: css`
    display: flex;
    flex-direction: row;
  `,
});
