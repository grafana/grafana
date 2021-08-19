import React, { ButtonHTMLAttributes, FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, ButtonVariant, IconName, useStyles } from '@grafana/ui';

export interface EmptyAreaProps {
  buttonLabel: string;
  onButtonClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  text: string;

  buttonIcon?: IconName;
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg';
  buttonVariant?: ButtonVariant;
}

export const EmptyArea: FC<EmptyAreaProps> = ({
  buttonIcon,
  buttonLabel,
  buttonSize = 'lg',
  buttonVariant = 'primary',
  onButtonClick,
  text,
}) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <p className={styles.text}>{text}</p>
      <Button
        className={styles.button}
        icon={buttonIcon}
        onClick={onButtonClick}
        size={buttonSize}
        type="button"
        variant={buttonVariant}
      >
        {buttonLabel}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      background-color: ${theme.colors.bg2};
      color: ${theme.colors.textSemiWeak};
      padding: ${theme.spacing.xl};
      text-align: center;
    `,
    text: css`
      margin-bottom: ${theme.spacing.md};
    `,
    button: css`
      margin: ${theme.spacing.md} 0 ${theme.spacing.sm};
    `,
  };
};
