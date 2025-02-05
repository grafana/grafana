import { css } from '@emotion/css';
import { useRef } from 'react';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../../themes';
import { CellNGProps, CellColors } from '../types';
import { getCellColors } from '../utils';

interface AutoCellProps extends CellNGProps {
  shouldTextOverflow: () => boolean;
  cellOptions: TableCellOptions;
}

export default function AutoCell({ value, field, justifyContent, shouldTextOverflow, cellOptions }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  const theme = useTheme2();

  // Get colors
  const colors = getCellColors(theme, cellOptions, displayValue);

  const styles = useStyles2(getStyles, colors);
  const divRef = useRef<HTMLDivElement>(null);
  // const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (shouldTextOverflow && !shouldTextOverflow()) {
      return;
    }
    // setIsHovered(true);

    const div = divRef.current;
    div?.parentElement?.style.setProperty('overflow', 'visible');
  };

  const handleMouseLeave = () => {
    if (shouldTextOverflow && !shouldTextOverflow()) {
      return;
    }

    // setIsHovered(false);

    const div = divRef.current;
    div?.parentElement?.style.setProperty('overflow', 'hidden');
  };

  return (
    <div
      ref={divRef}
      style={{ display: 'flex', justifyContent }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // className={isHovered ? styles.cell : ''}
      className={styles.defaultCell}
    >
      {formattedValue}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, color: CellColors) => ({
  cell: css({
    border: `1px solid ${theme.colors.border.medium}`,
    position: 'relative',
    whiteSpace: 'break-spaces',
    zIndex: `${theme.zIndex.activePanel}`,
  }),
  defaultCell: css({
    background: color.bgColor || theme.colors.background.primary,
    color: color.textColor,

    '&:hover': {
      background: color.bgHoverColor,
    },
  }),
});
