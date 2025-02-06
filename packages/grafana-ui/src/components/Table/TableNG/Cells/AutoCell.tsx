import { css } from '@emotion/css';
import { Property } from 'csstype';
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

// z-index value to be able to show the full text on hover
const CELL_Z_INDEX = '1';

export default function AutoCell({ value, field, justifyContent, shouldTextOverflow, cellOptions }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  const theme = useTheme2();

  // Get colors
  const colors = getCellColors(theme, cellOptions, displayValue);

  const styles = useStyles2(getStyles, colors, justifyContent);
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!shouldTextOverflow()) {
      return;
    }

    // TODO: The table cell styles in TableNG do not update dynamically even if we change the state
    const div = divRef.current;
    const tableCellDiv = div?.parentElement?.parentElement;
    tableCellDiv?.style.setProperty('position', 'absolute');
    tableCellDiv?.style.setProperty('top', '0');
    tableCellDiv?.style.setProperty('z-index', CELL_Z_INDEX);
    tableCellDiv?.style.setProperty('white-space', 'normal');
  };

  const handleMouseLeave = () => {
    if (!shouldTextOverflow()) {
      return;
    }

    // TODO: The table cell styles in TableNG do not update dynamically even if we change the state
    const div = divRef.current;
    const tableCellDiv = div?.parentElement?.parentElement;
    tableCellDiv?.style.setProperty('position', 'relative');
    tableCellDiv?.style.removeProperty('top');
    tableCellDiv?.style.removeProperty('z-index');
    tableCellDiv?.style.setProperty('white-space', 'nowrap');
  };

  return (
    <div ref={divRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className={styles.cell}>
      {formattedValue}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, color: CellColors, justifyContent: Property.JustifyContent) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent,
    // TODO: use background color for Cell type: Colored background
    // background: color.bgColor || theme.colors.background.primary,
    color: color.textColor,

    '&:hover': {
      // TODO: use background color for Cell type: Colored background
      // background: color.bgHoverColor,
    },
  }),
});
