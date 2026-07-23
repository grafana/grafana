import { css } from '@emotion/css';
import { type PropsWithChildren } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Portal } from '../../Portal/Portal';

interface Props {
  /** Screen coordinates (fixed) to anchor the popover's top-left. */
  anchor: { top: number; left: number };
}

/**
 * Renders the assistant popover through a Portal at the caret's screen
 * position. Using the portal container (at theme.zIndex.portal) keeps it above
 * panels and the Monaco suggest widget, and clear of editor `overflow: hidden`.
 */
export function PopoverOverlay({ anchor, children }: PropsWithChildren<Props>) {
  const styles = useStyles2(getStyles);
  return (
    <Portal>
      <div className={styles.wrap} style={{ top: anchor.top, left: anchor.left }}>
        {children}
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    position: 'fixed',
    // Above the editor's own overflow widgets (suggest/hover) and panel chrome.
    zIndex: theme.zIndex.tooltip,
  }),
});
