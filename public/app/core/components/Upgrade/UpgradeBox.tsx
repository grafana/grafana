import React, { HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

type ComponentSize = 'sm' | 'md';

export interface Props extends HTMLAttributes<HTMLOrSVGElement> {
  text: string;
  size?: ComponentSize;
}

export const UpgradeBox = ({ text, className, size = 'md', ...htmlProps }: Props) => {
  const styles = useStyles2((theme) => getUpgradeBoxStyles(theme, size));

  return (
    <div className={cx(styles.box, className)} {...htmlProps}>
      <Icon name={'arrow-up'} className={styles.icon} />
      <div>
        <h6>You’ve found a Pro feature!</h6>
        <p className={styles.text}>{text}</p>
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
    `,
    button: css`
      margin-top: ${theme.spacing(2)};

      &:focus-visible {
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
      }
    `,
    icon: css`
      border: 1px solid ${theme.colors.primary.shade};
      border-radius: 50%;
      margin: ${theme.spacing(0.5, 1, 0.5, 0.5)};
    `,
  };
};
