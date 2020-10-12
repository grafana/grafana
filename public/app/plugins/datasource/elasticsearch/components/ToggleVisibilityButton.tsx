import { useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useMemo } from 'react';
import { FunctionComponent } from 'react';
import { IconButton } from './IconButton';

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
  return <IconButton className={cx(hide && buttonCss)} iconName={hide ? 'eye-slash' : 'eye'} onClick={onClick} />;
};
