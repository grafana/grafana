import React, { FC, memo } from 'react';
import { css } from 'emotion';
import { Forms, stylesFactory } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick: any;
  editable?: boolean;
}

export const SearchCheckbox: FC<Props> = memo(({ onClick, checked = false, editable = false }) => {
  const styles = getStyles();

  return editable ? (
    <div onClick={onClick} className={styles.wrapper}>
      <Forms.Checkbox value={checked} />
    </div>
  ) : null;
});

const getStyles = stylesFactory(() => ({
  // Vertically align absolutely positioned checkbox element
  wrapper: css`
    height: 21px;
    & > label {
      height: 100%;
    }
  `,
}));
