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

    /* Temporary solution to display also font awesome icons */
    if (name?.startsWith('fa fa-')) {
      return <i role="img" className={getFontAwesomeIconStyles(name, className)} {...rest} style={style} />;
    }

    if (!isIconName(name)) {
      console.warn('Icon component passed an invalid icon name', name);
    }

    if (!name || name.includes('..')) {
      return <div>invalid icon name</div>;
    }

    const iconRoot = getIconRoot();
    const svgSize = getSvgSize(size);
    const svgHgt = svgSize;
    const svgWid = name.startsWith('gf-bar-align') ? 16 : name.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(name, type);
    const svgPath = `${iconRoot}${subDir}/${name}.svg`;

    return (
      <SVG
        innerRef={ref}
        src={svgPath}
        width={svgWid}
        height={svgHgt}
        title={title}
        className={cx(styles.icon, className, type === 'mono' ? { [styles.orange]: name === 'favorite' } : '')}
        style={style}
        {...rest}
      />
    );
  }
);

Icon.displayName = 'Icon';

function getFontAwesomeIconStyles(iconName: string, className?: string): string {
  return cx(
    iconName,
    {
      'fa-spin': iconName === 'fa fa-spinner',
    },
    className
  );
}
