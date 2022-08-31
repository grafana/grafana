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
  const navModel = useNavModel(navId).main;
  const styles = useStyles2(getStyles);
  const directChildren = navModel.children?.filter((child) => !child.hideFromTabs && !child.children);
  const nestedChildren = navModel.children?.filter((child) => child.children && child.children.length);
  return (
    <Page navId={navModel.id}>
      <Page.Contents>
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
        {nestedChildren?.map((child) => (
          <section key={child.id}>
            <h2 className={styles.nestedTitle}>{child.text}</h2>
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
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
