import React, { useState } from 'react';

import { Drawer, Icon } from '@grafana/ui';
import config from 'app/core/config';

import { NewsWrapper } from './NewsWrapper';

interface NewsContainerProps {
  buttonCss?: string;
}

export function NewsContainer({ buttonCss }: NewsContainerProps) {
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
          <NewsWrapper feedUrl={config.newsFeedUrl} />
        </Drawer>
      )}
    </>
  );
}
