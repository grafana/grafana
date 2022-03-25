import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmButton } from './ConfirmButton';
import { ComponentSize } from '../../types/size';
import { Button } from '../Button';
import { useStyles2 } from '../../themes';

export interface Props {
  /** Confirm action callback */
  onConfirm(): void;
  /** Button size */
  size?: ComponentSize;
  /** Disable button click action */
  disabled?: boolean;
  'aria-label'?: string;
}

export const DeleteButton: FC<Props> = ({ size, disabled, onConfirm, 'aria-label': ariaLabel }) => {
  const styles = useStyles2(getStyles);
  return (
    <ConfirmButton
      confirmText="Delete"
      confirmVariant="destructive"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
    >
      <Button
        type={'button'}
        aria-label={ariaLabel}
        variant="secondary"
        fill={'text'}
        icon={'trash-alt'}
        size={size || 'sm'}
        className={styles.button}
      />
    </ConfirmButton>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css`
      &:hover {
        color: ${theme.colors.error.main};
      }
    `,
  };
};
