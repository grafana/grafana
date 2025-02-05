import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useRef } from 'react';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { CellNGProps } from '../types';

interface AutoCellProps extends CellNGProps {
  shouldTextOverflow: () => boolean;
  setIsHovered: (isHovered: boolean) => void;
}

// z-index value to be able to show the full text on hover
const CELL_Z_INDEX = '1';

export default function AutoCell({ value, field, justifyContent, shouldTextOverflow }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  const styles = useStyles2(getStyles, justifyContent);
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

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent,
  }),
});
