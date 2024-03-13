import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types/icon';

import { getIconRoot, getIconSubDir, getSvgSize } from './utils';

export interface IconProps extends Omit<React.SVGProps<SVGElement>, 'onLoad' | 'onError' | 'ref'> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
  title?: string;
}

const getIconStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      display: 'inline-block',
      fill: 'currentColor',
      flexShrink: 0,
      label: 'Icon',
      // line-height: 0; is needed for correct icon alignment in Safari
      lineHeight: 0,
      verticalAlign: 'middle',
    }),
    orange: css({
      fill: theme.v1.palette.orange,
    }),
  };
};

export const Icon = React.forwardRef<SVGElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...rest }, ref) => {
    const styles = useStyles2(getIconStyles);

    if (!isIconName(name)) {
      console.warn('Icon component passed an invalid icon name', name);
    }

    // handle the deprecated 'fa fa-spinner'
    const iconName: IconName = name === 'fa fa-spinner' ? 'spinner' : name;

    const iconRoot = getIconRoot();
    const svgSize = getSvgSize(size);
    const svgHgt = svgSize;
    const svgWid = name.startsWith('gf-bar-align') ? 16 : name.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(iconName, type);
    const svgPath = `${iconRoot}${subDir}/${iconName}.svg`;

    const composedClassName = cx(
      styles.icon,
      className,
      type === 'mono' ? { [styles.orange]: name === 'favorite' } : '',
      iconName === 'spinner' && 'fa-spin'
    );

    return (
      <SVG
        aria-hidden={!rest['aria-label']}
        innerRef={ref}
        src={svgPath}
        width={svgWid}
        height={svgHgt}
        title={title}
        className={composedClassName}
        style={style}
        {...rest}
      />
    );
  }
);

Icon.displayName = 'Icon';
