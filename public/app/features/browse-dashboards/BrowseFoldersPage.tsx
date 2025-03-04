import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

function BrowseFoldersPage() {
  console.log('BrowseFoldersPage rendering');
  const styles = useStyles2(getStyles);

  return (
    <Page navId="folders" pageNav={{ text: 'Find folders' }}>
      <Page.Contents className={styles.pageContents}>
        <div>
          HELLO FOLDERS
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  }),
});

export default BrowseFoldersPage;
