import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, ToolbarButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';

import { NewsWrapper } from './NewsWrapper';

interface NewsContainerProps {
  className?: string;
}

export function NewsContainer({ className }: NewsContainerProps) {
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
  const titleWrapper = useStyles2(getStyles);

  const onChildClick = () => {
    onToggleShowNewsDrawer(true);
  };

  return (
    <>
      <ToolbarButton className={className} onClick={onChildClick} iconOnly icon="rss" aria-label="News" />
      {showNewsDrawer && (
        <Drawer
          title={t('news.title', 'Latest from the blog')}
          scrollableContent
          onClose={onToggleShowNewsDrawer}
          size="md"
        >
          <NewsWrapper feedUrl={DEFAULT_FEED_URL}>
            <div className={titleWrapper}>
              <img src="public/img/grot-news.svg" alt="Grot reading news" />
            </div>
          </NewsWrapper>
        </Drawer>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return css({
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    padding: theme.spacing(5, 0),

    img: {
      width: `186px`,
      height: `186px`,
    },
  });
}
