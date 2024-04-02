import React from 'react';

import { IconName } from '@grafana/data';
import { IconProps } from '@grafana/saga-icons';

import { iconToComponentMap } from './iconMap';
import { getSvgSize } from './utils';

interface Props extends IconProps {
  name: IconName;
}

export const Icon = React.forwardRef<SVGSVGElement, Props>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...rest }, ref) => {
    if (!iconToComponentMap[name]) {
      console.warn('Icon component passed an invalid icon name', name);
      return null; // TODO should this be a default icon?
    }

    const DynamicIconComponent = React.lazy(iconToComponentMap[name]);

    const iconSize = getSvgSize(size);
    return (
      <React.Suspense fallback={<div style={{ width: iconSize, height: iconSize }} />}>
        <DynamicIconComponent title={title} className={className} style={style} size={size} {...rest} />
      </React.Suspense>
    );
  }
);
Icon.displayName = 'Icon';
