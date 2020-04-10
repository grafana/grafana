import React from 'react';
import { Icon, getSvgSize } from '../Icon/Icon';
import { IconName, IconSize } from '../../types/icon';
import { stylesFactory } from '../../themes/stylesFactory';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';

export interface Props extends React.HTMLAttributes<HTMLButtonElement> {
  name: IconName;
  size?: IconSize;
  /** Need this to change hover effect based on what surface it is on */
  surface?: SurfaceType;
}

type SurfaceType = 'body' | 'panel' | 'header';

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ name, size = 'md', surface = 'panel', className, ...restProps }, ref) => {
    const theme = useTheme();
    const styles = getStyles(theme, surface, size);

    return (
      <button ref={ref} {...restProps} className={cx(styles.button, className)}>
        <Icon name={name} size={size} />
      </button>
    );
  }
);

function getHoverColor(theme: GrafanaTheme, surface: SurfaceType): string {
  switch (surface) {
    case 'body':
      return theme.isLight ? theme.colors.gray85 : theme.colors.gray15;
    case 'panel':
      return theme.isLight ? theme.colors.gray70 : theme.colors.gray25;
    case 'header':
      return theme.isLight ? theme.colors.gray70 : theme.colors.gray33;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme, surface: SurfaceType, size: IconSize) => {
  const hoverColor = getHoverColor(theme, surface);
  const pixelSize = getSvgSize(size, theme);

  return {
    button: css`
      width: ${pixelSize * theme.typography.lineHeight.md}px;
      height: ${pixelSize * theme.typography.lineHeight.md}px;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 0;
      margin-right: ${theme.spacing.xs};

      &:before {
        content: '';
        display: block;
        opacity: 1;
        position: absolute;
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        z-index: -1;
        bottom: -8px;
        left: -8px;
        right: -8px;
        top: -8px;
        background: none;
        border-radius: 50%;
        box-sizing: border-box;
        transform: scale(0);
        transition-property: transform, opacity;
      }

      &:hover {
        &:before {
          background-color: ${hoverColor};
          border: none;
          box-shadow: none;
          opacity: 1;
          transform: scale(0.7);
        }
      }
    `,
  };
});
