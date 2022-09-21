import React, { useState } from 'react';

import { Drawer, Icon } from '@grafana/ui';

import { NewsItem } from './NewsItem';

interface NewsProps {
  buttonCss?: string;
}

export function News({ buttonCss }: NewsProps) {
  const [showNewsDrawer, setShowNewsDrawer] = useState(false);

  const onChildClick = () => {
    setShowNewsDrawer(true);
  };

  return (
    <>
      <button className={buttonCss} onClick={onChildClick}>
        <Icon name="rss" size="lg" />
      </button>
      {showNewsDrawer && (
        <Drawer title="Latest from the blog" scrollableContent onClose={() => setShowNewsDrawer(false)}>
          <NewsItem />
        </Drawer>
      )}
    </>
  );
}
