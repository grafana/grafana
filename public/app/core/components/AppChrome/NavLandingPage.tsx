import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getNavTitle, getNavSubTitle } from '../NavBar/navBarItem-translations';

import { NavLandingPageCard } from './NavLandingPageCard';

interface Props {
  navId: string;
}

export function NavLandingPage({ navId }: Props) {
  const { node } = useNavModel(navId);
  const styles = useStyles2(getStyles);
  const children = node.children?.filter((child) => !child.hideFromTabs);

  return (
    <Page navId={node.id}>
      <Page.Contents>
        <div className={styles.content}>
          {children && children.length > 0 && (
            <section className={styles.grid}>
              {children?.map((child) => (
                <NavLandingPageCard
                  key={child.id}
                  description={getNavSubTitle(child.id) ?? child.subTitle}
                  text={getNavTitle(child.id) ?? child.text}
                  url={child.url ?? ''}
                />
              ))}
            </section>
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
    display: 'grid',
    gap: theme.spacing(3),
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gridAutoRows: '130px',
    padding: theme.spacing(2, 0),
  }),
});
