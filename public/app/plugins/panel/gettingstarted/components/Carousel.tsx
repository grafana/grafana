import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

export function Carousel({ children, page }: { page: number; children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  const [ref, onScroll, scrollBy, scrollProgress] = useCarousel(page);

  return (
    <div className={styles.carouselWrapper}>
      <IconButton
        className={styles.prevButton}
        variant="secondary"
        name="angle-left"
        tooltip="Previous"
        disabled={scrollProgress === 0}
        onClick={() => scrollBy(-1)}
        size="xl"
      />
      <IconButton
        className={styles.nextButton}
        variant="secondary"
        name="angle-right"
        tooltip="Next"
        disabled={scrollProgress === 1}
        onClick={() => scrollBy(1)}
        size="xl"
      />

      <div className={styles.stepCarousel} ref={ref} onScroll={onScroll}>
        {React.Children.map(children, (child, index) => (
          <div key={index} className={styles.step}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

function useCarousel(page: number) {
  const [{ scrollWidth, offsetWidth, scrollLeft }, setScrollData] = React.useState({
    scrollWidth: 0,
    offsetWidth: 0,
    scrollLeft: 0,
  });

  const handleScroll = (ev: { currentTarget: HTMLDivElement }) => {
    const { scrollWidth, offsetWidth, scrollLeft } = ev.currentTarget;
    setScrollData({ scrollWidth, offsetWidth, scrollLeft });
  };

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const handleCarouselRef = useCallback((el: HTMLDivElement | null) => {
    el && handleScroll({ currentTarget: el });
    carouselRef.current = el;
  }, []);

  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({
        left: getElementWidth(carouselRef.current) * page,
        behavior: 'instant',
      });
    }
  }, [page]);

  const scrollBy = useCallback((scrollBy: number) => {
    carouselRef.current && scrollElement(carouselRef.current, scrollBy);
  }, []);

  const scrollProgress = scrollLeft / (scrollWidth - offsetWidth);

  return [handleCarouselRef, handleScroll, scrollBy, scrollProgress] as const;
}

function getElementWidth(el: HTMLElement): number {
  const baseWidth = el.clientWidth;
  const computedStyles = window.getComputedStyle(el);
  const pageWidth =
    baseWidth - parseFloat(computedStyles.paddingLeft || '0') - parseFloat(computedStyles.paddingRight || '0');

  return pageWidth;
}

/**
 * Scrolls an element by a given percentage of its width
 * @param element Element to scroll
 * @param scrollBy Percentage of the element's width to scroll. Positive values scroll right, negative values scroll left
 */
function scrollElement(element: HTMLElement, scrollBy: number) {
  const scrollByPx = getElementWidth(element) * scrollBy;

  element.scrollTo({
    left: element.scrollLeft + scrollByPx,
    behavior: 'smooth',
  });
}

const getStyles = (theme: GrafanaTheme2) => {
  const nextPrevSpacing = 1;
  const nextPrevSize = 4; // xl button grid size
  const nextPrevGutter = nextPrevSize + nextPrevSpacing * 2;

  const buttonBase = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,

    ['&:disabled']: {
      opacity: 0,
      pointerEvents: 'none',
    },
  } as const;

  return {
    carouselWrapper: css({
      position: 'relative',
    }),
    nextButton: css(buttonBase, {
      right: theme.spacing(0.5 + nextPrevSpacing),
    }),
    prevButton: css(buttonBase, {
      left: theme.spacing(0.5 + nextPrevSpacing),
    }),
    stepCarousel: css({
      position: 'relative',
      zIndex: 1,
      overflowX: 'auto',
      display: 'flex',
      flexWrap: 'nowrap',
      scrollSnapType: 'x proximity',
      padding: theme.spacing(2, 0),
    }),
    step: css({
      scrollSnapAlign: 'start',
      flexShrink: 0,
      paddingLeft: theme.spacing(nextPrevGutter),

      display: 'flex',
      '& > div': {
        flex: 1,
      },

      // Make last step full width so when it scrolls it can snap to the start of the container
      '&:last-of-type': {
        minWidth: '100%',
        // paddingRight: theme.spacing(nextPrevGutter),
      },

      '&:first-of-type': {},
    }),
  };
};
