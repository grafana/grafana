import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { getResponsiveStyle, ResponsiveProp } from './responsiveness';

export interface SizeProps {
  minWidth?: ResponsiveProp<Property.MinWidth<number>>;
  maxWidth?: ResponsiveProp<Property.MaxWidth<number>>;
  width?: ResponsiveProp<Property.Width<number>>;

  minHeight?: ResponsiveProp<Property.MinHeight<number>>;
  maxHeight?: ResponsiveProp<Property.MaxHeight<number>>;
  height?: ResponsiveProp<Property.Height<number>>;
}
export const getSizeStyles = (
  theme: GrafanaTheme2,
  width: SizeProps['width'],
  minWidth: SizeProps['minWidth'],
  maxWidth: SizeProps['maxWidth'],
  height: SizeProps['height'],
  minHeight: SizeProps['minHeight'],
  maxHeight: SizeProps['maxHeight']
) => {
  return css([
    getResponsiveStyle(theme, width, (val) => ({
      width: theme.spacing(val),
    })),
    getResponsiveStyle(theme, minWidth, (val) => ({
      minWidth: theme.spacing(val),
    })),
    getResponsiveStyle(theme, maxWidth, (val) => ({
      maxWidth: theme.spacing(val),
    })),
    getResponsiveStyle(theme, height, (val) => ({
      height: theme.spacing(val),
    })),
    getResponsiveStyle(theme, minHeight, (val) => ({
      minHeight: theme.spacing(val),
    })),
    getResponsiveStyle(theme, maxHeight, (val) => ({
      maxHeight: theme.spacing(val),
    })),
  ]);
};
