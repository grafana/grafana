import React, { useEffect, useState } from 'react';

import { IconName } from '@grafana/data';
import { IconProps } from '@grafana/saga-icons';

import { iconToComponentMap } from './iconMap';
import { getSvgSize } from './utils';

interface Props extends IconProps {
  name: IconName;
}

export const Icon = React.forwardRef<SVGSVGElement, Props>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...rest }, ref) => {
    const [DynamicIconComponent, setDynamicIconComponent] = useState<React.ComponentType<IconProps> | null>(null);
    useEffect(() => {
      const iconName: IconName = name === 'fa fa-spinner' ? 'spinner' : name;

      if (!iconToComponentMap[iconName]) {
        console.warn('Icon component passed an invalid icon name', iconName);
        return;
      }
      iconToComponentMap[iconName]()
        .then((Comp) => {
          setDynamicIconComponent(() => Comp.default);
        })
        .catch((error) => console.error(`Failed to load icon: ${iconName}`, error));
    }, [name]);

    if (!DynamicIconComponent) {
      const iconSize = getSvgSize(size);
      return <div style={{ width: iconSize, height: iconSize }} />; //TODO should this return a default icon instead?
    }

    return <DynamicIconComponent title={title} className={className} style={style} size={size} {...rest} />;
  }
);
Icon.displayName = 'Icon';
