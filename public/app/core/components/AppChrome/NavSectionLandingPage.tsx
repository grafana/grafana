import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconName, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavSectionLandingPageCard } from './NavSectionLandingPageCard';

interface Props {
  navId: string;
}

export function NavSectionLandingPage({ navId }: Props) {
  const { node } = useNavModel(navId);
  const styles = useStyles2(getStyles);
  const directChildren = node.children?.filter((child) => !child.hideFromTabs && !child.children);
  const nestedChildren = node.children?.filter((child) => child.children && child.children.length);

  return (
    <Page navId={node.id}>
      <Page.Contents>
        <div className={styles.content}>
          {directChildren && directChildren.length > 0 && (
            <section className={styles.grid}>
              {directChildren?.map((child) => (
                <NavSectionLandingPageCard
                  key={child.id}
                  description={child.description}
                  icon={child.icon as IconName}
                  text={child.text}
                  url={child.url ?? ''}
                />
              ))}
            </section>
          )}
          {nestedChildren?.map((child) => (
            <section key={child.id}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 className={styles.nestedTitle}>{child.text}</h2>
              </div>
              <div className={styles.nestedDescription}>{child.subTitle}</div>
              <div className={styles.grid}>
                {child.children?.map((child) => (
                  <NavSectionLandingPageCard
                    key={child.id}
                    description={child.description}
                    icon={child.icon as IconName}
                    text={child.text}
                    url={child.url ?? ''}
                  />
                ))}
              </div>
            </section>
          ))}
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
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gridAutoRows: 'minmax(200px, 1fr)',
    padding: theme.spacing(2, 1),
  }),
  nestedTitle: css({
    margin: theme.spacing(2, 0),
  }),
  nestedDescription: css({
    color: theme.colors.text.secondary,
  }),
});
