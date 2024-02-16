import React, { useEffect } from 'react';

import { config } from '@grafana/runtime';
import { CustomScrollbar, useTheme2 } from '@grafana/ui';

type FlaggedScrollerProps = Parameters<typeof CustomScrollbar>[0];

export default function FlaggedScroller(props: FlaggedScrollerProps) {
  const theme = useTheme2();

  useEffect(() => {
    if (config.featureToggles.removeCustomScrollbars && window.location.search.includes('styleScrollbars')) {
      // @ts-ignore - no, trust me, scrollbarColor really is there
      document.body.style.scrollbarColor = `${theme.colors.action.focus} transparent`;
    }
  }, [theme]);

  if (config.featureToggles.removeCustomScrollbars) {
    return props.children;
  }

  return <CustomScrollbar {...props} />;
}
