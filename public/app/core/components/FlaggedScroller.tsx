import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2, useTheme2 } from '@grafana/ui';

type FlaggedScrollerProps = Parameters<typeof CustomScrollbar>[0];

export default function FlaggedScroller(props: FlaggedScrollerProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  useEffect(() => {
    if (config.featureToggles.removeCustomScrollbars && window.location.search.includes('styleScrollbars')) {
      // @ts-ignore - no, trust me, scrollbarColor really is there
      document.body.style.scrollbarColor = `${theme.colors.action.focus} transparent`;
    }
  }, [theme]);

  if (config.featureToggles.removeCustomScrollbars) {
    return <div className={styles.nativeScrollbars}>{props.children}</div>;
  }

  return <CustomScrollbar {...props} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    nativeScrollbars: css({
      minHeight: `calc(100% + 0px)`,
      maxHeight: `calc(100% + 0px)`,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'auto',
    }),
  };
}
