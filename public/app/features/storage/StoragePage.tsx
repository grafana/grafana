import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { dataFrameToJSON, GrafanaTheme2 } from '@grafana/data';
import { FilterInput, Spinner, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getGrafanaStorage } from './helper';

export default function StoragePage() {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const [searchQuery, setSearchQuery] = useState('');
  const [path] = useState('upload'); // from URL?

  const folder = useAsync(async () => {
    return getGrafanaStorage().list(path);
  }, [path]);

  const renderFolder = () => {
    if (folder.value) {
      if (!folder.value.length) {
        return <div>nothing... TODO, big upload form</div>;
      }

      return (
        <div>
          <pre>{JSON.stringify(dataFrameToJSON(folder.value), null, 2)}</pre>
        </div>
      );
    }
    if (folder.loading) {
      return <Spinner />;
    }
    return <div>??</div>; // should not be possible
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={folder.loading}>
        <div className={styles.toolbar}>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or type" width={50} />
        </div>

        {renderFolder()}
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
