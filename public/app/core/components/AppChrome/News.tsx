import React, { useState } from 'react';

import { Drawer } from '@grafana/ui';

import { NewsItem } from './NewsItem';

export function News({ children }: { children: React.ReactElement }) {
  const [showNewsDrawer, setShowNewsDrawer] = useState(false);

  const onChildClick = () => {
    setShowNewsDrawer(true);
  };

  return (
    <>
      {React.cloneElement(children, { onClick: onChildClick })}
      {showNewsDrawer && (
        <Drawer scrollableContent onClose={() => setShowNewsDrawer(false)}>
          <NewsItem />
        </Drawer>
      )}
    </>
  );
}
