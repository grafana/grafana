import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export const ScrollIndicators = ({ children }: React.PropsWithChildren<{}>) => {
  const [showScrollTopIndicator, setShowTopScrollIndicator] = useState(false);
  const [showScrollBottomIndicator, setShowBottomScrollIndicator] = useState(false);
  const scrollTopMarker = useRef<HTMLDivElement>(null);
  const scrollBottomMarker = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);

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
    <>
      <div
        className={cx(styles.scrollIndicator, styles.scrollTopIndicator, {
          [styles.scrollIndicatorVisible]: showScrollTopIndicator,
        })}
        role="presentation"
      />
      <div className={styles.scrollContent}>
        <div ref={scrollTopMarker} className={cx(styles.scrollMarker, styles.scrollTopMarker)} />
        {children}
        <div ref={scrollBottomMarker} className={cx(styles.scrollMarker, styles.scrollBottomMarker)} />
      </div>
      <div
        className={cx(styles.scrollIndicator, styles.scrollBottomIndicator, {
          [styles.scrollIndicatorVisible]: showScrollBottomIndicator,
        })}
        role="presentation"
      />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  // we specifically don't want a theme color here
  // this gradient is more like a shadow
  const scrollGradientColor = `rgba(0, 0, 0, ${theme.isDark ? 0.25 : 0.08})`;
  return {
    scrollContent: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    scrollIndicator: css({
      height: `max(5%, ${theme.spacing(3)})`,
      left: 0,
      opacity: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create('opacity'),
      },
      zIndex: 1,
    }),
    scrollTopIndicator: css({
      background: `linear-gradient(0deg, transparent, ${scrollGradientColor})`,
      top: 0,
    }),
    scrollBottomIndicator: css({
      background: `linear-gradient(180deg, transparent, ${scrollGradientColor})`,
      bottom: 0,
    }),
    scrollIndicatorVisible: css({
      opacity: 1,
    }),
    scrollMarker: css({
      height: '1px',
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
    }),
    scrollTopMarker: css({
      top: 0,
    }),
    scrollBottomMarker: css({
      bottom: 0,
    }),
  };
};
