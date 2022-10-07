import React, { useState } from 'react';
import { useToggle } from 'react-use';

import { Drawer, ToolbarButton, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';

import { NewsWrapper } from './NewsWrapper';

export function NewsContainer() {
  const theme = useTheme2();
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e: MediaQueryListEvent) => {
      setIsSmallScreen(e.matches);
    },
    value: isSmallScreen,
  });

  const onChildClick = () => {
    onToggleShowNewsDrawer(true);
  };

  if (isSmallScreen) {
    return null;
  }

  return (
    <>
      <ToolbarButton onClick={onChildClick} iconOnly icon="rss" aria-label="News" />
      {showNewsDrawer && (
        <Drawer title="Latest from the blog" scrollableContent onClose={onToggleShowNewsDrawer}>
          <NewsWrapper feedUrl={DEFAULT_FEED_URL} />
        </Drawer>
      )}
    </>
  );
}
