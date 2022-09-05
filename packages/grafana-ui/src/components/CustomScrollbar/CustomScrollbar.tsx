import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import React, { FC, RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import Scrollbars, { positionValues } from 'react-custom-scrollbars-2';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

export type ScrollbarPosition = positionValues;

interface Props {
  className?: string;
  testId?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  autoHeightMax?: string;
  hideTracksWhenNotNeeded?: boolean;
  hideHorizontalTrack?: boolean;
  hideVerticalTrack?: boolean;
  scrollRefCallback?: RefCallback<HTMLDivElement>;
  scrollTop?: number;
  setScrollTop?: (position: ScrollbarPosition) => void;
  showScrollIndicators?: boolean;
  autoHeightMin?: number | string;
  updateAfterMountMs?: number;
  onScroll?: React.UIEventHandler;
}

/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export const CustomScrollbar: FC<Props> = ({
  autoHide = false,
  autoHideTimeout = 200,
  setScrollTop,
  className,
  testId,
  autoHeightMin = '0',
  autoHeightMax = '100%',
  hideTracksWhenNotNeeded = false,
  hideHorizontalTrack,
  hideVerticalTrack,
  scrollRefCallback,
  showScrollIndicators = false,
  updateAfterMountMs,
  scrollTop,
  onScroll,
  children,
}) => {
  const ref = useRef<Scrollbars & { view: HTMLDivElement }>(null);
  const [showScrollTopIndicator, setShowTopScrollIndicator] = useState(false);
  const [showScrollBottomIndicator, setShowBottomScrollIndicator] = useState(false);
  const scrollTopMarker = useRef<HTMLDivElement>(null);
  const scrollBottomMarker = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (ref.current && scrollRefCallback) {
      scrollRefCallback(ref.current.view);
    }
  }, [ref, scrollRefCallback]);

  useEffect(() => {
    if (ref.current && scrollTop != null) {
      ref.current.scrollTop(scrollTop);
    }
  }, [scrollTop]);

  /**
   * Special logic for doing a update a few milliseconds after mount to check for
   * updated height due to dynamic content
   */
  useEffect(() => {
    if (!updateAfterMountMs) {
      return;
    }
    setTimeout(() => {
      const scrollbar = ref.current as any;
      if (scrollbar?.update) {
        scrollbar.update();
      }
    }, updateAfterMountMs);
  }, [updateAfterMountMs]);

  // Here we observe the top and bottom markers to determine if we should show the scroll indicators
  useEffect(() => {
    if (showScrollIndicators) {
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
    }
    return;
  }, [showScrollIndicators]);

  function renderTrack(className: string, hideTrack: boolean | undefined, passedProps: JSX.IntrinsicElements['div']) {
    if (passedProps.style && hideTrack) {
      passedProps.style.display = 'none';
    }

    return <div {...passedProps} className={className} />;
  }

  const renderTrackHorizontal = useCallback(
    (passedProps: JSX.IntrinsicElements['div']) => {
      return renderTrack('track-horizontal', hideHorizontalTrack, passedProps);
    },
    [hideHorizontalTrack]
  );

  const renderTrackVertical = useCallback(
    (passedProps: JSX.IntrinsicElements['div']) => {
      return renderTrack('track-vertical', hideVerticalTrack, passedProps);
    },
    [hideVerticalTrack]
  );

  const renderThumbHorizontal = useCallback((passedProps: JSX.IntrinsicElements['div']) => {
    return <div {...passedProps} className="thumb-horizontal" />;
  }, []);

  const renderThumbVertical = useCallback((passedProps: JSX.IntrinsicElements['div']) => {
    return <div {...passedProps} className="thumb-vertical" />;
  }, []);

  const renderView = useCallback((passedProps: JSX.IntrinsicElements['div']) => {
    return <div {...passedProps} className="scrollbar-view" />;
  }, []);

  const onScrollStop = useCallback(() => {
    ref.current && setScrollTop && setScrollTop(ref.current.getValues());
  }, [setScrollTop]);

  const scrollChildren = showScrollIndicators ? (
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
  ) : (
    children
  );

  return (
    <Scrollbars
      data-testid={testId}
      ref={ref}
      className={cx(styles.customScrollbar, className, {
        [styles.scrollContainer]: showScrollIndicators,
      })}
      onScrollStop={onScrollStop}
      autoHeight={true}
      autoHide={autoHide}
      autoHideTimeout={autoHideTimeout}
      hideTracksWhenNotNeeded={hideTracksWhenNotNeeded}
      // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
      // Before these where set to inherit but that caused problems with cut of legends in firefox
      autoHeightMax={autoHeightMax}
      autoHeightMin={autoHeightMin}
      renderTrackHorizontal={renderTrackHorizontal}
      renderTrackVertical={renderTrackVertical}
      renderThumbHorizontal={renderThumbHorizontal}
      renderThumbVertical={renderThumbVertical}
      renderView={renderView}
      onScroll={onScroll}
    >
      {scrollChildren}
    </Scrollbars>
  );
};

export default CustomScrollbar;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    customScrollbar: css`
      // Fix for Firefox. For some reason sometimes .view container gets a height of its content, but in order to
      // make scroll working it should fit outer container size (scroll appears only when inner container size is
      // greater than outer one).
      display: flex;
      flex-grow: 1;
      .scrollbar-view {
        display: flex;
        flex-grow: 1;
        flex-direction: column;
      }
      .track-vertical {
        border-radius: ${theme.shape.borderRadius(2)};
        width: ${theme.spacing(1)} !important;
        right: 0px;
        bottom: ${theme.spacing(0.25)};
        top: ${theme.spacing(0.25)};
      }
      .track-horizontal {
        border-radius: ${theme.shape.borderRadius(2)};
        height: ${theme.spacing(1)} !important;
        right: ${theme.spacing(0.25)};
        bottom: ${theme.spacing(0.25)};
        left: ${theme.spacing(0.25)};
      }
      .thumb-vertical {
        background: ${theme.colors.action.focus};
        border-radius: ${theme.shape.borderRadius(2)};
        opacity: 0;
      }
      .thumb-horizontal {
        background: ${theme.colors.action.focus};
        border-radius: ${theme.shape.borderRadius(2)};
        opacity: 0;
      }
      &:hover {
        .thumb-vertical,
        .thumb-horizontal {
          opacity: 1;
          transition: opacity 0.3s ease-in-out;
        }
      }
    `,
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
    scrollIndicator: css({
      height: theme.spacing(6),
      left: 0,
      opacity: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      transition: theme.transitions.create('opacity'),
      zIndex: theme.zIndex.sidemenu,
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
