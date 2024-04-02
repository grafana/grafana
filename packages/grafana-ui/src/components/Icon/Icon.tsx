import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconProps } from '@grafana/saga-icons';

import { useStyles2 } from '../../themes/ThemeContext';

import { iconToComponentMap, IconName } from './iconMap';

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

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...rest }, ref) => {
    const styles = useStyles2(getIconStyles);

    const iconName: IconName = (name === 'fa fa-spinner' ? 'spinner' : name) as IconName;

    if (!iconToComponentMap[iconName]) {
      console.warn('Icon component passed an invalid icon name', name);
      return null; // TODO should this be a default icon?
    }

    // Dynamically load the IconComponent
    const DynamicIconComponent = React.lazy(iconToComponentMap[iconName]);

    const composedClassName = cx(
      styles.icon,
      className,
      type === 'mono' ? { [styles.orange]: name === 'favorite' } : '',
      iconName === 'spinner' && 'fa-spin'
    );

    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicIconComponent title={title} className={composedClassName} style={style} size={size} {...rest} />
      </React.Suspense>
    );
  }
);
Icon.displayName = 'Icon';
