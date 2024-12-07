import { css } from '@emotion/css';
import { useState, useRef } from 'react';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { CellNGProps } from '../types';

export default function AutoCell({ value, field, justifyContent, shouldTextOverflow }: CellNGProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  const styles = useStyles2(getStyles);
  const divRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (shouldTextOverflow && !shouldTextOverflow()) {
      return;
    }
    setIsHovered(true);

    const div = divRef.current;
    div?.parentElement?.style.setProperty('overflow', 'visible');
  };

  const handleMouseLeave = () => {
    if (shouldTextOverflow && !shouldTextOverflow()) {
      return;
    }

    setIsHovered(false);

    const div = divRef.current;
    div?.parentElement?.style.setProperty('overflow', 'hidden');
  };

  return (
    <div
      ref={divRef}
      style={{ display: 'flex', justifyContent }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={isHovered ? styles.cell : ''}
    >
      {formattedValue}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cell: css({
    whiteSpace: 'break-spaces',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    zIndex: `${theme.zIndex.activePanel}`,
    position: 'relative',
  }),
});
