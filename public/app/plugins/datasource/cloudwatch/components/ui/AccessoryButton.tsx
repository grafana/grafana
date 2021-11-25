import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import { Button, ButtonProps } from '@grafana/ui/src/components/Button';
import React from 'react';

interface AccessoryButtonProps extends ButtonProps {}

const AccessoryButton: React.FC<AccessoryButtonProps> = ({ className, ...props }) => {
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

export default AccessoryButton;
