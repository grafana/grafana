import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipRow } from './VizTooltipRow';
import { VizTooltipItem } from './types';

interface Props {
  item: VizTooltipItem;
  isPinned: boolean;
}
export const VizTooltipHeader = ({ item, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  const { label, value, color, colorIndicator } = item;

  return (
    <div className={styles.wrapper}>
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(1),
    lineHeight: 1,
  }),
});
