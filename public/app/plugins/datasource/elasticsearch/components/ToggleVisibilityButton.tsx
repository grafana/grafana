import { Icon, useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useMemo } from 'react';
import { FunctionComponent } from 'react';

interface Props {
  onClick: () => void;
  hide: boolean;
}

export const ToggleVisibilityButton: FunctionComponent<Props> = ({ onClick, hide }) => {
  const theme = useTheme();

  const buttonCss = useMemo(() => {
    return css`
      &,
      &:hover {
        color: ${theme.colors.textFaint};
      }
    `;
  }, [theme]);

  // TODO: The button should have proper aria attributes
  return (
    <button className={cx('gf-form-label gf-form-label--btn query-part', hide && buttonCss)} onClick={onClick}>
      <Icon name={hide ? 'eye-slash' : 'eye'} />
    </button>
  );
};
