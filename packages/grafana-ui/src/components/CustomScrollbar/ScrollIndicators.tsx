import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import React, { FC, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

export const ScrollIndicators: FC = ({ children }) => {
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
      >
        <Icon className={classNames(styles.scrollIcon, styles.scrollTopIcon)} name="angle-up" />
      </div>
      <div className={styles.scrollContent}>
        <div ref={scrollTopMarker} />
        {children}
        <div ref={scrollBottomMarker} />
      </div>
      <div
        className={cx(styles.scrollIndicator, styles.scrollBottomIndicator, {
          [styles.scrollIndicatorVisible]: showScrollBottomIndicator,
        })}
      >
        <Icon className={classNames(styles.scrollIcon, styles.scrollBottomIcon)} name="angle-down" />
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    scrollContent: css({
      flex: 1,
      position: 'relative',
    }),
    scrollIndicator: css({
      height: theme.spacing(6),
      left: 0,
      opacity: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      transition: theme.transitions.create('opacity'),
      zIndex: 1,
    }),
    scrollTopIndicator: css({
      background: `linear-gradient(0deg, transparent, ${theme.colors.background.canvas})`,
      top: 0,
    }),
    scrollBottomIndicator: css({
      background: `linear-gradient(180deg, transparent, ${theme.colors.background.canvas})`,
      bottom: 0,
    }),
    scrollIndicatorVisible: css({
      opacity: 1,
    }),
    scrollIcon: css({
      left: '50%',
      position: 'absolute',
      transform: 'translateX(-50%)',
    }),
    scrollTopIcon: css({
      top: 0,
    }),
    scrollBottomIcon: css({
      bottom: 0,
    }),
  };
};
