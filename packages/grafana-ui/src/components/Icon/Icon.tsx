import React, { useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import { camelCase } from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes';
import { useTheme } from '../../themes/ThemeContext';
import { IconName, IconType } from '../../types';
import { ComponentSize } from '../../types/size';

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: ComponentSize | 'xl';
  type?: IconType;
  color?: string;
}
export interface SvgProps extends React.HTMLAttributes<SVGElement> {
  size: number;
  color: string;
  secondaryColor?: string;
  className?: string;
}

type Module = {
  default: React.ComponentType<SvgProps>;
};

const getIconStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      vertical-align: middle;
      display: inline-block;
      margin-bottom: ${theme.spacing.xxs};
      cursor: pointer;
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

    useEffect(() => {
      if (type === 'default') {
        import(`./assets/icons/uil-${name}`).then(module => {
          setIcon(module);
        });
      }
      if (type === 'mono') {
        const monoIconName = pascalCase(name);
        import(`./assets/${monoIconName}`).then(module => {
          setIcon(module);
        });
      }
    }, [name, type]);

    const theme = useTheme();
    const styles = getIconStyles(theme);
    const mainColor = color || theme.colors.orange;
    const secondaryColor = `${mainColor}99`;

    /* Transform string with px to number and add 2 pxs as path in svg is 2px smaller*/
    const svgSize =
      size === 'xl'
        ? Number(theme.typography.heading.h1.slice(0, -2))
        : Number(theme.typography.size[size].slice(0, -2)) + 2;

    const Component = icon?.default;
    if (!Component) {
      return <div style={{ width: `${svgSize}px` }}></div>;
    }

    return (
      <span className={cx({ [styles.currentFontColor]: !color && type === 'default' })} {...divElementProps} ref={ref}>
        {type === 'default' && <Component color={mainColor} size={svgSize} className={cx(styles.icon, className)} />}
        {type === 'mono' && (
          <Component
            color={mainColor}
            secondaryColor={secondaryColor}
            size={svgSize}
            className={cx(styles.icon, className)}
          />
        )}
      </span>
    );
  }
);

Icon.displayName = 'Icon';

const pascalCase = (string: string) => {
  const str = camelCase(string);
  return str.charAt(0).toUpperCase() + str.substring(1);
};
