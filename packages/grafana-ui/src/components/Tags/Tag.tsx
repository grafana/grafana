import React, { forwardRef, HTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTagColor, getTagColorsFromName } from '../../utils';

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
    if (onClick) {
      onClick(name, event);
    }
  };

  return (
    <span key={name} ref={ref} onClick={onTagClick} className={cx(styles.wrapper, className)} {...rest}>
      {name}
    </span>
  );
});

const getTagStyles = (theme: GrafanaTheme, name: string, colorIndex?: number) => {
  let colors;
  if (colorIndex === undefined) {
    colors = getTagColorsFromName(name);
  } else {
    colors = getTagColor(colorIndex);
  }
  return {
    wrapper: css`
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

      :hover {
        opacity: 0.85;
        cursor: pointer;
      }
    `,
  };
};
