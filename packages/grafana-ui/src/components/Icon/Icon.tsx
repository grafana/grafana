import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, toPascalCase } from '@grafana/data';
import { stylesFactory } from '../../themes';
import { useTheme } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types';
import { ComponentSize } from '../../types/size';
//@ts-ignore
import * as DefaultIcon from '@iconscout/react-unicons';
import * as MonoIcon from './assets';

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
}
export interface SvgProps extends React.HTMLAttributes<SVGElement> {
  size: number;
  secondaryColor?: string;
  className?: string;
}

const getIconStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: inline-block;
      fill: ${defaultIconColor};
    `,
    icon: css`
      vertical-align: middle;
      display: inline-block;
      margin-bottom: 2px;
      cursor: pointer;
      fill: currentColor;
    `,
    orange: css`
      fill: ${theme.colors.orange};
    `,
  };
});

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, ...divElementProps }, ref) => {
    const theme = useTheme();
    const styles = getIconStyles(theme);
    const svgSize = getSvgSize(size, theme);

    /* Temporary solution to display also font awesome icons */
    const isFontAwesome = name?.includes('fa-');
    if (isFontAwesome) {
      return <i className={cx(name, className)} {...divElementProps} style={style} />;
    }

    const iconName = type === 'default' ? `Uil${toPascalCase(name)}` : toPascalCase(name);

    /* Unicons don't have type definitions */
    //@ts-ignore
    const Component = type === 'default' ? DefaultIcon[iconName] : MonoIcon[iconName];

    if (!Component) {
      return <div />;
    }

    return (
      <div className={styles.container} {...divElementProps} ref={ref}>
        {type === 'default' && <Component size={svgSize} className={cx(styles.icon, className)} style={style} />}
        {type === 'mono' && (
          <Component
            size={svgSize}
            className={cx(styles.icon, { [styles.orange]: name === 'favorite' }, className)}
            style={style}
          />
        )}
      </div>
    );
  }
);

Icon.displayName = 'Icon';

/* Transform string with px to number and add 2 pxs as path in svg is 2px smaller */
const getSvgSize = (size: ComponentSize | 'xl' | 'xxl', theme: GrafanaTheme) => {
  console.log(theme);
  let svgSize;
  if (size === 'xl') {
    svgSize = Number(theme.typography.heading.h1.slice(0, -2));
  } else if (size === 'xxl') {
    svgSize = Number(theme.height.lg.slice(0, -2));
  } else {
    svgSize = Number(theme.typography.size[size].slice(0, -2)) + 2;
  }
  return svgSize;
};
