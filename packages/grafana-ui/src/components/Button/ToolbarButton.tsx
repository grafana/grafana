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
  /** Controls flex-grow: 1 */
  fullWidth?: boolean;
  /** reduces padding to xs */
  narrow?: boolean;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, Props>(
  ({ tooltip, icon, className, children, imgSrc, fullWidth, isOpen, narrow, ...rest }, ref) => {
    const styles = useStyles(getStyles);

    const contentStyles = cx({
      [styles.content]: true,
      [styles.contentWithIcon]: !!icon,
      [styles.contentWithRightIcon]: isOpen !== undefined,
    });

    const buttonStyles = cx(
      {
        [styles.button]: true,
        [styles.buttonFullWidth]: fullWidth,
        [styles.narrow]: narrow,
      },
      className
    );

    const body = (
      <button ref={ref} className={buttonStyles} {...rest}>
        {icon && <Icon name={icon} size={'lg'} />}
        {imgSrc && <img className={styles.img} src={imgSrc} />}
        {children && <span className={contentStyles}>{children}</span>}
        {isOpen === false && <Icon name="angle-down" />}
        {isOpen === true && <Icon name="angle-up" />}
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
    border: 1px solid ${theme.colors.border2};
    height: ${theme.height.md}px;
    padding: 0 ${theme.spacing.sm};
    color: ${theme.colors.textWeak};
    border-radius: ${theme.border.radius.sm};
    display: flex;
    align-items: center;

    &:focus {
      outline: none;
    }

    &:hover {
      color: ${theme.colors.text};
      background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
    }
  `,
  narrow: css`
    padding: 0 ${theme.spacing.xs};
  `,
  img: css`
    width: 16px;
    height: 16px;
    margin-right: ${theme.spacing.sm};
  `,
  buttonFullWidth: css`
    flex-grow: 1;
  `,
  content: css`
    flex-grow: 1;
  `,
  contentWithIcon: css`
    padding-left: ${theme.spacing.sm};
  `,
  contentWithRightIcon: css`
    padding-right: ${theme.spacing.sm};
  `,
});
