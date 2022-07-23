import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomScrollbar, Icon, useTheme2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
}

export const NavBarScrollContainer = ({ children }: Props) => {
  const [showScrollTopIndicator, setShowTopScrollIndicator] = useState(false);
  const [showScrollBottomIndicator, setShowBottomScrollIndicator] = useState(false);
  const scrollTopMarker = useRef<HTMLDivElement>(null);
  const scrollBottomMarker = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const styles = getStyles(theme);

  // Here we observe the top and bottom markers to determine if we should show the scroll indicators
  useEffect(() => {
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === scrollTopMarker.current) {
          setShowTopScrollIndicator(!entry.isIntersecting);
        } else if (entry.target === scrollBottomMarker.current) {
          setShowBottomScrollIndicator(!entry.isIntersecting);
        }
      });
    });
    [scrollTopMarker, scrollBottomMarker].forEach((ref) => {
      if (ref.current) {
        intersectionObserver.observe(ref.current);
      }
    });
    return () => intersectionObserver.disconnect();
  }, []);

  return (
    <CustomScrollbar className={styles.scrollContainer} hideVerticalTrack hideHorizontalTrack>
      <div
        className={cx(styles.scrollTopIndicator, {
          [styles.scrollIndicatorVisible]: showScrollTopIndicator,
        })}
      >
        <Icon className={styles.scrollTopIcon} name="angle-up" />
      </div>
      <div className={styles.scrollContent}>
        <div className={styles.scrollTopMarker} ref={scrollTopMarker}></div>
        {children}
        <div className={styles.scrollBottomMarker} ref={scrollBottomMarker}></div>
      </div>
      <div
        className={cx(styles.scrollBottomIndicator, {
          [styles.scrollIndicatorVisible]: showScrollBottomIndicator,
        })}
      >
        <Icon className={styles.scrollBottomIcon} name="angle-down" />
      </div>
    </CustomScrollbar>
  );
};

NavBarScrollContainer.displayName = 'NavBarScrollContainer';

const getStyles = (theme: GrafanaTheme2) => ({
  'scrollTopMarker, scrollBottomMarker': css({
    height: theme.spacing(1),
    left: 0,
    position: 'absolute',
    pointerEvents: 'none',
    right: 0,
  }),
  scrollTopMarker: css({
    top: 0,
  }),
  scrollBottomMarker: css({
    bottom: 0,
  }),
  scrollContent: css({
    flex: 1,
    position: 'relative',
  }),
  // override the scroll container position so that the scroll indicators
  // are positioned at the top and bottom correctly.
  // react-custom-scrollbars doesn't provide any way for us to hook in nicely,
  // so we have to override with !important. feelsbad.
  scrollContainer: css`
    .scrollbar-view {
      position: static !important;
    }
  `,
  scrollTopIndicator: css({
    background: `linear-gradient(0deg, transparent, ${theme.colors.background.canvas})`,
    height: theme.spacing(6),
    left: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    transition: theme.transitions.create('opacity'),
    zIndex: theme.zIndex.sidemenu,
  }),
  scrollBottomIndicator: css({
    background: `linear-gradient(0deg, ${theme.colors.background.canvas}, transparent)`,
    bottom: 0,
    height: theme.spacing(6),
    left: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    transition: theme.transitions.create('opacity'),
    zIndex: theme.zIndex.sidemenu,
  }),
  scrollIndicatorVisible: css({
    opacity: 1,
  }),
  scrollTopIcon: css({
    left: '50%',
    position: 'absolute',
    top: 0,
    transform: 'translateX(-50%)',
  }),
  scrollBottomIcon: css({
    bottom: 0,
    left: '50%',
    position: 'absolute',
    transform: 'translateX(-50%)',
  }),
});
