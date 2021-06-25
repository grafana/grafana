import React, { FC, memo } from 'react';
import { cx, css } from '@emotion/css';
import { Checkbox, stylesFactory } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  className?: string;
  editable?: boolean;
}

export const SearchCheckbox: FC<Props> = memo(({ onClick, className, checked = false, editable = false }) => {
  const styles = getStyles();

  return editable ? (
    <div onClick={onClick} className={cx(className)}>
      <Checkbox value={checked} />
    </div>
  ) : null;
});

const getStyles = stylesFactory(() => ({
  wrapper: css`
    height: 21px;
    & > label {
      height: 100%;

      & > input {
        position: relative;
      }
    }
  `,
}));

SearchCheckbox.displayName = 'SearchCheckbox';
