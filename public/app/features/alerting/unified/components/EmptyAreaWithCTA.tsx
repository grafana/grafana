import React, { ButtonHTMLAttributes, FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, ButtonVariant, IconName, LinkButton, useStyles } from '@grafana/ui';
import { EmptyArea } from './EmptyArea';

export interface EmptyAreaWithCTAProps {
  buttonLabel: string;
  href?: string;
  onButtonClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
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
  href,
}) => {
  const styles = useStyles(getStyles);

  const commonProps = {
    className: styles.button,
    icon: buttonIcon,
    size: buttonSize,
    variant: buttonVariant,
  };

  return (
    <EmptyArea>
      <>
        <p className={styles.text}>{text}</p>
        {href ? (
          <LinkButton href={href} type="button" {...commonProps}>
            {buttonLabel}
          </LinkButton>
        ) : (
          <Button onClick={onButtonClick} type="button" {...commonProps}>
            {buttonLabel}
          </Button>
        )}
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
