import React, { FC, memo } from 'react';
import { css } from 'emotion';
import { Checkbox, stylesFactory } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick: any;
  editable?: boolean;
}

export const SearchCheckbox: FC<Props> = memo(({ onClick, checked = false, editable = false }) => {
  const styles = getStyles();

  return editable ? (
    <div onClick={onClick} className={styles.wrapper}>
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
