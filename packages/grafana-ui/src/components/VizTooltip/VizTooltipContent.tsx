import { css } from '@emotion/css';
import { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipRow } from './VizTooltipRow';
import { VizTooltipItem } from './types';

interface VizTooltipContentProps {
  items: VizTooltipItem[];
  children?: ReactNode;
  scrollable?: boolean;
  isPinned: boolean;
  maxHeight?: number;
}

export const VizTooltipContent = ({
  items,
  children,
  isPinned,
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
      {items.map(({ label, value, color, colorIndicator, colorPlacement, isActive, lineStyle }, i) => (
        <VizTooltipRow
          key={i}
          label={label}
          value={value}
          color={color}
          colorIndicator={colorIndicator}
          colorPlacement={colorPlacement}
          isActive={isActive}
          justify={'space-between'}
          isPinned={isPinned}
          lineStyle={lineStyle}
          showValueScroll={!scrollable}
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
