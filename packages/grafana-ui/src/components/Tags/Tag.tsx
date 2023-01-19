import { cx, css } from '@emotion/css';
import React, { forwardRef, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { getTagColor, getTagColorsFromName } from '../../utils';
import { Icon } from '../Icon/Icon';

/**
 * @public
 */
export type OnTagClick = (name: string, event: React.MouseEvent<HTMLElement>) => void;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  icon?: IconName;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling. */
  colorIndex?: number;
  onClick?: OnTagClick;
}

export const Tag = forwardRef<HTMLElement, Props>(({ name, onClick, icon, className, colorIndex, ...rest }, ref) => {
  const theme = useTheme2();
  const styles = getTagStyles(theme, name, colorIndex);

  const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onClick?.(name, event);
  };

  const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

  return onClick ? (
    <button {...rest} className={classes} onClick={onTagClick} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
      {icon && <Icon name={icon} />}
      {name}
    </button>
  ) : (
    <span {...rest} className={classes} ref={ref}>
      {icon && <Icon name={icon} />}
      {name}
    </span>
  );
});

Tag.displayName = 'Tag';

const getTagStyles = (theme: GrafanaTheme2, name: string, colorIndex?: number) => {
  let colors;
  if (colorIndex === undefined) {
    colors = getTagColorsFromName(name);
  } else {
    colors = getTagColor(colorIndex);
  }
  return {
    wrapper: css`
      appearance: none;
      border-style: none;
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.bodySmall.lineHeight};
      vertical-align: baseline;
      background-color: ${colors.color};
      color: ${theme.v1.palette.gray98};
      white-space: nowrap;
      text-shadow: none;
      padding: 3px 6px;
      border-radius: ${theme.shape.borderRadius(2)};
    `,
    hover: css`
      &:hover {
        opacity: 0.85;
        cursor: pointer;
      }
    `,
  };
};
