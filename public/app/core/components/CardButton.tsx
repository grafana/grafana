import { css } from '@emotion/css';
import React, { HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  onClick: () => void;
  children: React.ReactNode;
}

export const CardButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ icon, children, onClick, ...restProps }, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <button {...restProps} className={styles.action} onClick={onClick}>
        <Icon name={icon} size="xl" />
        {children}
      </button>
    );
  }
);

CardButton.displayName = 'CardButton';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    action: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',

      justifySelf: 'center',
      cursor: 'pointer',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      border: 'unset',
      width: '100%',

      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary),
      },
    }),
  };
};
