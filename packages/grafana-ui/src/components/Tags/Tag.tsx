import React, { forwardRef, HTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTagColorsFromName } from '../../utils';

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  onClick?: (name: string) => any;
}

export const Tag = forwardRef<HTMLElement, Props>(({ name, onClick, className, ...rest }, ref) => {
  const theme = useTheme();
  const styles = getTagStyles(theme, name);

  const onTagClick = () => {
    if (onClick) {
      onClick(name);
    }
  };

  return (
    <span key={name} ref={ref} onClick={onTagClick} className={cx(styles.wrapper, className)} {...rest}>
      {name}
    </span>
  );
});

const getTagStyles = (theme: GrafanaTheme, name: string) => {
  const { borderColor, color } = getTagColorsFromName(name);
  return {
    wrapper: css`
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.xs};
      vertical-align: baseline;
      background-color: ${color};
      color: ${theme.colors.white};
      white-space: nowrap;
      text-shadow: none;
      padding: 3px 6px;
      border: 1px solid ${borderColor};
      border-radius: ${theme.border.radius.md};

      :hover {
        opacity: 0.85;
        cursor: pointer;
      }
    `,
  };
};
