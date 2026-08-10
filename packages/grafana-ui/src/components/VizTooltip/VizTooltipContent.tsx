import { css } from '@emotion/css';
import { type CSSProperties, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipRow } from './VizTooltipRow';
import { type VizTooltipItem } from './types';

interface VizTooltipContentProps {
  /** The rows to render, one per series or field. */
  items: VizTooltipItem[];
  children?: ReactNode;
  /** When true the content area becomes vertically scrollable, constrained by `maxHeight`. */
  scrollable?: boolean;
  /**
   * Whether the tooltip is currently pinned (locked open by the user).
   * When pinned, label and value cells become clickable to copy their text to the clipboard.
   * Defaults to `false`.
   */
  isPinned?: boolean;
  /** Maximum height in pixels of the scrollable content area. Only applied when `scrollable` is true. */
  maxHeight?: number;
}

/** @alpha */
export const VizTooltipContent = ({
  items,
  children,
  isPinned = false,
  scrollable = false,
  maxHeight,
}: VizTooltipContentProps) => {
  const styles = useStyles2(getStyles);

  const scrollableStyle: CSSProperties = scrollable
    ? {
        maxHeight: maxHeight,
        overflowY: 'auto',
      }
    : {};

  return (
    <div className={styles.wrapper} style={scrollableStyle}>
      {items.map(({ label, value, color, colorIndicator, colorPlacement, isActive, lineStyle, isHiddenFromViz }, i) => (
        <VizTooltipRow
          key={i}
          label={label}
          value={value}
          color={color}
          colorIndicator={colorIndicator}
          colorPlacement={colorPlacement}
          isActive={isActive}
          isPinned={isPinned}
          lineStyle={lineStyle}
          showValueScroll={!scrollable}
          isHiddenFromViz={isHiddenFromViz}
        />
      ))}
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 2,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
});
