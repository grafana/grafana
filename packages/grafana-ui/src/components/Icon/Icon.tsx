import React, { useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import { camelCase } from 'lodash';

import { stylesFactory } from '../../themes';
import { useTheme } from '../../themes/ThemeContext';
import { IconType } from './types';
import { ComponentSize } from '../../types/size';

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconType;
  size?: ComponentSize;
  color?: string;
  type?: 'default' | 'mono';
}
export type SvgProps = {
  size: number;
  color: string;
  secondaryColor?: string;
};

type Module = {
  default: React.ComponentType<SvgProps>;
};

const getIconStyles = stylesFactory(() => {
  return {
    icon: css`
      display: inline-block;
      * {
        vertical-align: middle;
      }
    `,
    currentFontColor: css`
      svg {
        fill: currentColor;
      }
    `,
  };
});

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', color, title, name, className, ...divElementProps }, ref) => {
    const [icon, setIcon] = useState<null | Module>(null);

    const pascalCase = (string: string) => {
      const str = camelCase(string);
      return str.charAt(0).toUpperCase() + str.substring(1);
    };

    useEffect(() => {
      if (type === 'default') {
        import(`@iconscout/react-unicons/icons/uil-${name}`).then(module => {
          setIcon(module);
        });
      }
      if (type === 'mono') {
        const monoIconName = pascalCase(name);
        import(`./assets/${monoIconName}`).then(module => {
          setIcon(module);
        });
      }
    }, []);

    const theme = useTheme();
    const styles = getIconStyles();
    const mainColor = color || theme.colors.orange;
    const secondaryColor = `${mainColor}99`;

    /* Transform string with px to number */
    const svgSize = Number(theme.typography.size[size].slice(0, -2));

    const Component = icon?.default;
    if (!Component) {
      return null;
    }

    return (
      <div
        className={cx(styles.icon, { [styles.currentFontColor]: !color && type === 'default' }, className)}
        {...divElementProps}
        ref={ref}
      >
        {type === 'default' && <Component color={mainColor} size={svgSize} />}
        {type === 'mono' && <Component color={mainColor} secondaryColor={secondaryColor} size={svgSize} />}
      </div>
    );
  }
);
