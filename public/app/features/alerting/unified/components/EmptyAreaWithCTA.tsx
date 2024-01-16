import { css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ButtonVariant, IconName, LinkButton, useStyles2 } from '@grafana/ui';

import { EmptyArea } from './EmptyArea';

export interface EmptyAreaWithCTAProps {
  buttonLabel: string;
  href?: string;
  onButtonClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  text: string;

  buttonIcon?: IconName;
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg';
  buttonVariant?: ButtonVariant;
  showButton?: boolean;
}

export const EmptyAreaWithCTA = ({
  buttonIcon,
  buttonLabel,
  buttonSize = 'lg',
  buttonVariant = 'primary',
  onButtonClick,
  text,
  href,
  showButton = true,
}: EmptyAreaWithCTAProps) => {
  const styles = useStyles2(getStyles);

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
        {showButton &&
          (href ? (
            <LinkButton href={href} type="button" {...commonProps}>
              {buttonLabel}
            </LinkButton>
          ) : (
            <Button onClick={onButtonClick} type="button" {...commonProps}>
              {buttonLabel}
            </Button>
          ))}
      </>
    </EmptyArea>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(4)};
      text-align: center;
    `,
    text: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    button: css`
      margin: ${theme.spacing(2, 0, 1)};
    `,
  };
};
