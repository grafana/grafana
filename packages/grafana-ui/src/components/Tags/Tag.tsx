import React, { forwardRef, HTMLAttributes } from 'react';
import { cx, css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTagColor, getTagColorsFromName } from '../../utils';

/**
 * @public
 */
export type OnTagClick = (name: string, event: React.MouseEvent<HTMLElement>) => any;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling. */
  colorIndex?: number;
  onClick?: OnTagClick;
}

export const Tag = forwardRef<HTMLElement, Props>(({ name, onClick, className, colorIndex, ...rest }, ref) => {
  const theme = useTheme();
  const styles = getTagStyles(theme, name, colorIndex);

  const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onClick?.(name, event);
  };

  const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

  return onClick ? (
    <button {...rest} className={classes} onClick={onTagClick} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
      {name}
    </button>
  ) : (
    <span {...rest} className={classes} ref={ref}>
      {name}
    </span>
  );
});

Tag.displayName = 'Tag';

const getTagStyles = (theme: GrafanaTheme, name: string, colorIndex?: number) => {
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
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.xs};
      vertical-align: baseline;
      background-color: ${colors.color};
      color: ${theme.palette.gray98};
      white-space: nowrap;
      text-shadow: none;
      padding: 3px 6px;
      border-radius: ${theme.border.radius.md};
    `,
    hover: css`
      &:hover {
        opacity: 0.85;
        cursor: pointer;
      }
    `,
  };
};
