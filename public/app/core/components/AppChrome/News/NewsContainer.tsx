import React from 'react';
import { useToggle } from 'react-use';

import { Drawer, Icon } from '@grafana/ui';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';

import { NewsWrapper } from './NewsWrapper';

interface NewsContainerProps {
  buttonCss?: string;
}

export function NewsContainer({ buttonCss }: NewsContainerProps) {
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);

  const onChildClick = () => {
    onToggleShowNewsDrawer(true);
  };

  return (
    <>
      <button className={buttonCss} onClick={onChildClick}>
        <Icon name="rss" size="lg" />
      </button>
      {showNewsDrawer && (
        <Drawer title="Latest from the blog" scrollableContent onClose={onToggleShowNewsDrawer}>
          <NewsWrapper feedUrl={DEFAULT_FEED_URL} />
        </Drawer>
      )}
    </>
  );
}
