import React, { useEffect, useRef, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { CustomScrollbar, useTheme2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';

export interface Props {
  children: React.ReactNode;
}

export const NavBarScrollContainer = ({ children }: Props) => {
  const [showScrollTopIndicator, setShowTopScrollIndicator] = useState(false);
  const [showScrollBottomIndicator, setShowBottomScrollIndicator] = useState(false);
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const styles = getStyles(theme);

  useEffect(() => {
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === scrollTopRef.current) {
          setShowTopScrollIndicator(!entry.isIntersecting);
        } else if (entry.target === scrollBottomRef.current) {
          setShowBottomScrollIndicator(!entry.isIntersecting);
        }
      });
    });
    [scrollTopRef, scrollBottomRef].forEach((ref) => {
      if (ref.current) {
        intersectionObserver.observe(ref.current);
      }
    });
    return () => intersectionObserver.disconnect();
  }, []);

  return (
    <CustomScrollbar
      className={cx(styles.scrollContainer, {
        [styles.scrollTopVisible]: showScrollTopIndicator,
        [styles.scrollBottomVisible]: showScrollBottomIndicator,
      })}
      hideVerticalTrack
      hideHorizontalTrack
    >
      <div className={styles.scrollContent}>
        <div className={styles.scrollTopMarker} ref={scrollTopRef}></div>
        {children}
        <div className={styles.scrollBottomMarker} ref={scrollBottomRef}></div>
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
    position: 'relative',
  }),
  scrollContainer: css({
    '&:before, &:after': {
      content: "''",
      color: theme.colors.text.primary,
      position: 'absolute',
      left: 0,
      right: 0,
      height: theme.spacing(6),
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease-in-out',
      zIndex: theme.zIndex.sidemenu - 1,
    },
    '&:before': {
      top: 0,
      background: `linear-gradient(0deg, transparent, ${theme.colors.background.canvas})`,
    },
    '&:after': {
      bottom: 0,
      background: `linear-gradient(0deg, ${theme.colors.background.canvas}, transparent)`,
    },
  }),
  scrollTopVisible: css({
    '&:before': {
      opacity: 1,
    },
  }),
  scrollBottomVisible: css({
    '&:after': {
      opacity: 1,
    },
  }),
});
