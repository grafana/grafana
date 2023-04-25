import { cx } from '@emotion/css';
import React, { FC, useState } from 'react';

import { useStyles2 } from '@grafana/ui';

import { Icon } from '../Icon';

import { getStyles } from './Chip.styles';

export interface ChipProps {
  text: string;
  isRemovable?: boolean;
  onRemove?: (text: string) => void;
  className?: string;
}

export const Chip: FC<ChipProps> = ({ text, isRemovable = false, onRemove = () => null, className }) => {
  const styles = useStyles2(getStyles);
  const [show, setShow] = useState(true);

  const handleCloseClick = () => {
    onRemove(text);
    setShow(false);
  };

  return show ? (
    <div data-testid="chip" className={cx(styles.wrapper, className)}>
      {text}
      {isRemovable && (
        <Icon
          name="cross"
          width="8px"
          height="8px"
          data-testid="chip-remove"
          onClick={handleCloseClick}
          className={styles.removeIcon}
        />
      )}
    </div>
  ) : null;
};
