import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Drawer, ToolbarButton, useStyles2 } from '@grafana/ui';
import { H3 } from '@grafana/ui/src/unstable';
import { t } from 'app/core/internationalization';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';

import { NewsWrapper } from './NewsWrapper';

interface NewsContainerProps {
  className?: string;
}

export function NewsContainer({ className }: NewsContainerProps) {
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
  const styles = useStyles2(getStyles);

  return (
    <>
      <ToolbarButton className={className} onClick={onToggleShowNewsDrawer} iconOnly icon="rss" aria-label="News" />
      {showNewsDrawer && (
        <Drawer
          title={
            <div className={styles.title}>
              <H3>{t('news.title', 'Latest from the blog')}</H3>
              <a
                href="https://grafana.com/blog/"
                target="_blank"
                rel="noreferrer"
                title="Go to Grafana labs blog"
                className={styles.grot}
              >
                <img src="public/img/grot-news.svg" alt="Grot reading news" />
              </a>
              <div className={styles.actions}>
                <Button
                  icon="times"
                  variant="secondary"
                  fill="text"
                  onClick={onToggleShowNewsDrawer}
                  aria-label={selectors.components.Drawer.General.close}
                />
              </div>
            </div>
          }
          scrollableContent
          onClose={onToggleShowNewsDrawer}
          size="md"
        >
          <NewsWrapper feedUrl={DEFAULT_FEED_URL} />
        </Drawer>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      display: `flex`,
      alignItems: `center`,
      justifyContent: `center`,
      gap: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    grot: css({
      display: `flex`,
      alignItems: `center`,
      justifyContent: `center`,
      padding: theme.spacing(2, 0),

      img: {
        width: `75px`,
        height: `75px`,
      },
    }),
    actions: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(2),
    }),
  };
};
