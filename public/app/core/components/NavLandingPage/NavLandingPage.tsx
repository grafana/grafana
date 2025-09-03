import { css } from '@emotion/css';
import * as React from 'react';
import { useLocation } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
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
  const { pathname } = useLocation();
  const children = node.children?.filter((child) => !child.hideFromTabs);

  const { component: ObservabilityLandingPage, isLoading: isObservabilityLandingPageLoading } = usePluginComponent<{
    childrenNodes: NavModelItem[];
  }>('grafana-asserts-app/landing-page-extension/v1');
  if (isObservabilityLandingPageLoading) {
    return null;
  }

  if (pathname === '/observability' && ObservabilityLandingPage) {
    return <ObservabilityLandingPage childrenNodes={children ?? []} />;
  }

  return (
    <Page navId={node.id}>
      <Page.Contents>
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
