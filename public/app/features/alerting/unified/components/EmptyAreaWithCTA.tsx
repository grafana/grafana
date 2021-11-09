import React, { ButtonHTMLAttributes, FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, ButtonVariant, IconName, useStyles } from '@grafana/ui';
import { EmptyArea } from './EmptyArea';

export interface EmptyAreaWithCTAProps {
  buttonLabel: string;
  onButtonClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  text: string;

  buttonIcon?: IconName;
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg';
  buttonVariant?: ButtonVariant;
}

export const EmptyAreaWithCTA: FC<EmptyAreaWithCTAProps> = ({
  buttonIcon,
  buttonLabel,
  buttonSize = 'lg',
  buttonVariant = 'primary',
  onButtonClick,
  text,
}) => {
  const styles = useStyles(getStyles);

  return (
    <EmptyArea>
      <>
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
      </>
    </EmptyArea>
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
