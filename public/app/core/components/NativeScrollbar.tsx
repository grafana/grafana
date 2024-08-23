import { css, cx } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
  onSetScrollRef?: (ref: ScrollRefElement) => void;
  divId?: string;
}

export interface ScrollRefElement {
  scrollTop: number;
  scrollTo: (x: number, y: number) => void;
}

// Shim to provide API-compatibility for Page's scroll-related props
// when bodyScrolling is enabled, this is a no-op
// TODO remove this shim completely when bodyScrolling is enabled
export default function NativeScrollbar({ children, onSetScrollRef, divId }: Props) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config.featureToggles.bodyScrolling && onSetScrollRef) {
      onSetScrollRef(new WindowScrollElement());
    }

    if (!config.featureToggles.bodyScrolling && ref.current && onSetScrollRef) {
      onSetScrollRef(ref.current);
    }
  }, [ref, onSetScrollRef]);

  return config.featureToggles.bodyScrolling ? (
    children
  ) : (
    // Set the .scrollbar-view class to help e2e tests find this, like in CustomScrollbar
    <div ref={ref} className={cx(styles.nativeScrollbars, 'scrollbar-view')} id={divId}>
      {children}
    </div>
  );
}

class WindowScrollElement {
  public get scrollTop() {
    return window.scrollY;
  }

  public scrollTo(x: number, y: number) {
    window.scrollTo(x, y);
  }
}

function getStyles() {
  return {
    nativeScrollbars: css({
      label: 'native-scroll-container',
      minHeight: `calc(100% + 0px)`, // I don't know, just copied from custom scrollbars
      maxHeight: `calc(100% + 0px)`, // I don't know, just copied from custom scrollbars
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'auto',
    }),
  };
}
