import React from 'react';
import { useToggle } from 'react-use';

import { Drawer, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';

import { NewsWrapper } from './NewsWrapper';

export function NewsContainer() {
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);

  const onChildClick = () => {
    onToggleShowNewsDrawer(true);
  };

  return (
    <>
      <ToolbarButton onClick={onChildClick} iconOnly icon="rss" aria-label="News" />
      {showNewsDrawer && (
        <Drawer title={t('news.title', 'Latest from the blog')} scrollableContent onClose={onToggleShowNewsDrawer}>
          <NewsWrapper feedUrl={DEFAULT_FEED_URL} />
        </Drawer>
      )}
    </>
  );
}
