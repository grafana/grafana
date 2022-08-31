import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2, stylesFactory } from '../../themes';
import { Button, ButtonProps } from '../Button';

interface AccessoryButtonProps extends ButtonProps {}

export const AccessoryButton: React.FC<AccessoryButtonProps> = ({ className, ...props }) => {
  const theme = useTheme2();
  const styles = getButtonStyles(theme);

  return <Button {...props} className={cx(className, styles.button)} />;
};

const getButtonStyles = stylesFactory((theme: GrafanaTheme2) => ({
  button: css({
    paddingLeft: theme.spacing(3 / 2),
    paddingRight: theme.spacing(3 / 2),
  }),
}));
