import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';

export function HomePageFrame({ children, title }: { children: ReactNode; title?: string }) {
  const styles = useStyles2(getStyles);
  const name = contextSrv.user.name.trim().split(/\s+/)[0] || contextSrv.user.login || 'there';

  return (
    <Page
      navId="home"
      pageNav={{ text: t('home.repositories.title', 'Home'), hideFromBreadcrumbs: true }}
      layout={PageLayoutType.Canvas}
    >
      <Page.Contents className={styles.content}>
        <h1 className={styles.greeting}>
          {title ?? t('home.goals.greeting', "Hi, {{name}}, what's your goal today?", { name })}
        </h1>
        {children}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: theme.spacing(3),
    width: '100%',
    maxWidth: 1040,
    minHeight: '100%',
    margin: 'auto',
    padding: theme.spacing(6, 2),
    [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
  }),
  greeting: css({
    ...theme.typography.h1,
    textAlign: 'center',
    textWrap: 'balance',
    maxWidth: '28ch',
    margin: 0,
    overflowWrap: 'anywhere',
  }),
});
