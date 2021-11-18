import React, { HTMLAttributes } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLDivElement> {
  icon: IconName;
  onClick: () => void;
  children: React.ReactNode;
}

export const CardButton = React.forwardRef<HTMLDivElement, Props>(({ icon, children, onClick, ...restProps }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <div {...restProps} className={styles.action} onClick={onClick}>
      <div>
        <Icon name={icon} size="xl" />
        {children}
      </div>
    </div>
  );
});

CardButton.displayName = 'CardButton';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    action: css`
      display: flex;
      flex-direction: row;
      height: 100%;

      > div {
        justify-self: center;
        cursor: pointer;
        background: ${theme.colors.background.secondary};
        border-radius: ${theme.shape.borderRadius(1)};
        color: ${theme.colors.text.primary};
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;

        &:hover {
          background: ${theme.colors.emphasize(theme.colors.background.secondary)};
        }
      }
    `,
  };
};
