import React, { ReactNode, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

type ComponentSize = 'sm' | 'md';

export interface Props extends HTMLAttributes<HTMLOrSVGElement> {
  text?: string;
  size?: ComponentSize;
  children?: ReactNode;
  secondaryAction?: {
    url: string;
    text: string;
  };
}

export const UpgradeBox = ({ text, className, children, secondaryAction, size = 'md', ...htmlProps }: Props) => {
  const styles = useStyles2((theme) => getUpgradeBoxStyles(theme, size));

  return (
    <div className={cx(styles.box, className)} {...htmlProps}>
      <Icon name={'rocket'} className={styles.icon} />
      <div>
        <h4>You’ve found a Pro feature!</h4>
        {text && <p className={styles.text}>{text}</p>}
        {children}
        <LinkButton
          variant="primary"
          size={size}
          className={styles.button}
          href="https://grafana.com/profile/org/subscription"
          target="__blank"
          rel="noopener noreferrer"
        >
          Upgrade to Pro
        </LinkButton>

        {secondaryAction && (
          <LinkButton
            variant="link"
            size={size}
            className={cx(styles.button, styles.buttonSecondary)}
            href={secondaryAction.url}
            target="__blank"
            rel="noopener noreferrer"
          >
            {secondaryAction.text}
          </LinkButton>
        )}
      </div>
    </div>
  );
};

const getUpgradeBoxStyles = (theme: GrafanaTheme2, size: ComponentSize) => {
  const borderRadius = theme.shape.borderRadius(2);
  const fontBase = size === 'md' ? 'body' : 'bodySmall';

  return {
    box: css`
      display: flex;
      position: relative;
      border-radius: ${borderRadius};
      background: ${theme.colors.primary.transparent};
      border: 1px solid ${theme.colors.primary.shade};
      padding: ${theme.spacing(2)};
      color: ${theme.colors.primary.text};
      font-size: ${theme.typography[fontBase].fontSize};
      text-align: left;
      line-height: 16px;
    `,
    text: css`
      margin-bottom: 0;
      padding: ${theme.spacing(2, 0)};
      line-height: 1.5;
    `,
    button: css`
      margin-top: ${theme.spacing(2)};

      &:first-of-type {
        margin-right: ${theme.spacing(1)};
      }

      &:focus-visible {
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
      }
    `,
    buttonSecondary: css`
      color: ${theme.colors.text.secondary};
    `,
    icon: css`
      margin: ${theme.spacing(0.5, 1, 0.5, 0.5)};
    `,
  };
};
