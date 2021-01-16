import React, { forwardRef, HTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, useStyles } from '../../themes';
import { IconName } from '../../types/icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';

export interface Props extends HTMLAttributes<HTMLButtonElement> {
  /** Icon name */
  icon?: IconName;
  /** Tooltip */
  tooltip?: string;
  /** For image icons */
  imgSrc?: string;
  /** if true or false will show angle-down/up */
  isOpen?: boolean;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, Props>(
  ({ tooltip, icon, className, children, imgSrc, isOpen, ...rest }, ref) => {
    const styles = useStyles(getStyles);
    const contentStyles = cx({
      [styles.content]: true,
      [styles.contentWithIcon]: !!icon,
    });

    const body = (
      <button ref={ref} className={cx(styles.button, className)} {...rest}>
        {icon && <Icon name={icon} size={'lg'} />}
        {imgSrc && <img src={imgSrc} />}
        {children && <span className={contentStyles}>{children}</span>}
        {isOpen === false && <Icon className={styles.angleIcon} name="angle-down" />}
        {isOpen === true && <Icon className={styles.angleIcon} name="angle-up" />}
      </button>
    );

    return tooltip ? (
      <Tooltip content={tooltip} placement="bottom">
        {body}
      </Tooltip>
    ) : (
      body
    );
  }
);

const getStyles = (theme: GrafanaTheme) => ({
  button: css`
    background: ${theme.colors.bg1};
    border: 1px solid ${theme.colors.border1};
    height: ${theme.height.md}px;
    padding: 0 ${theme.spacing.sm};
    color: ${theme.colors.textWeak};
    border-radius: ${theme.border.radius.md};
    display: flex;
    align-items: center;
    flex-grow: 1;

    &:focus {
      outline: none;
    }

    img {
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing.sm};
    }

    &:hover {
      color: ${theme.colors.text};
      background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
    }
  `,
  angleIcon: css`
    margin-left: ${theme.spacing.sm};
  `,
  content: css`
    margin: 1;
  `,
  contentWithIcon: css`
    padding-left: ${theme.spacing.sm};
  `,
});
