import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Grid } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPageCard } from './NavLandingPageCard';

interface Props {
  navId: string;
  header?: React.ReactNode;
}

export function NavLandingPage({ navId, header }: Props) {
  const { node } = useNavModel(navId);
  const styles = useStyles2(getStyles);
  const theme: GrafanaTheme2 = useTheme2();
  const children = node.children?.filter((child) => !child.hideFromTabs);
  const gridChildren = children?.map((child) => (
    <NavLandingPageCard key={child.id} description={child.subTitle} text={child.text} url={child.url ?? ''} />
  ));
  return (
    <Page navId={node.id}>
      <Page.Contents>
        <div className={styles.content}>
          {header}
          {gridChildren && gridChildren.length > 0 && (
            <Grid
              display="grid"
              gap={theme.spacing(3)}
              templateColumns="repeat(auto-fill, minmax(300px, 1fr))"
              autoRows="138px"
            >
              {gridChildren}
            </Grid>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  grid: css({
    padding: theme.spacing(2, 0),
  }),
});
