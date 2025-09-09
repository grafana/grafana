import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPageCard } from './NavLandingPageCard';

interface Props {
  navId: string;
  header?: React.ReactNode;
}

const EXTENSION_ID = (nodeId: string) => `grafana/nav-landing-page/${nodeId}/v1`;

export function NavLandingPage({ navId, header }: Props) {
  const { node } = useNavModel(navId);
  const styles = useStyles2(getStyles);
  const children = node.children?.filter((child) => !child.hideFromTabs);

  const { components, isLoading } = usePluginComponents<{
    node: NavModelItem;
  }>({
    extensionPointId: EXTENSION_ID(node.id ?? ''),
  });

  if (isLoading) {
    return null;
  }

  return (
    <Page navId={node.id}>
      <Page.Contents>
        {components?.length > 0 ? (
          components.map((Component, idx) => <Component key={idx} node={node} />)
        ) : (
          <div className={styles.content}>
            {header}
            {children && children.length > 0 && (
              <section className={styles.grid}>
                {children?.map((child) => (
                  <NavLandingPageCard
                    key={child.id}
                    description={child.subTitle}
                    text={child.text}
                    url={child.url ?? ''}
                  />
                ))}
              </section>
            )}
          </div>
        )}
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
    gridAutoRows: '138px',
    padding: theme.spacing(2, 0),
  }),
});
