import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipRow } from './VizTooltipRow';
import { type VizTooltipItem } from './types';

export interface VizTooltipHeaderProps {
  /** The item to display in the header row, typically the x-axis or time value. */
  item: VizTooltipItem;
  /**
   * Whether the tooltip is currently pinned (locked open by the user).
   * When pinned, the label and value become clickable to copy their text to the clipboard.
   */
  isPinned: boolean;
}

export const VizTooltipHeader = ({
  item: { label, value, color, colorIndicator },
  isPinned,
}: VizTooltipHeaderProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles}>
      <VizTooltipRow
        label={label}
        value={value}
        color={color}
        colorIndicator={colorIndicator}
        marginRight={'22px'}
        isPinned={isPinned}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(1),
    lineHeight: 1,
  });
