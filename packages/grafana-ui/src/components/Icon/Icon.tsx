import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, toPascalCase } from '@grafana/data';
import { stylesFactory } from '../../themes/stylesFactory';
import { useTheme } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types/icon';
//@ts-ignore
import * as DefaultIcon from '@iconscout/react-unicons';
import * as MonoIcon from './assets';

const alwaysMonoIcons = ['grafana', 'favorite', 'heart-break', 'heart'];

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
}

const getIconStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: inline-block;
    `,
    icon: css`
      vertical-align: middle;
      display: inline-block;
      margin-bottom: ${theme.spacing.xxs};
      fill: currentColor;
    `,
    orange: css`
      fill: ${theme.palette.orange};
    `,
  };
});

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, ...divElementProps }, ref) => {
    const theme = useTheme();
    const styles = getIconStyles(theme);
    const svgSize = getSvgSize(size);

    /* Temporary solution to display also font awesome icons */
    const isFontAwesome = name?.includes('fa-');
    if (isFontAwesome) {
      return <i className={cx(name, className)} {...divElementProps} style={style} />;
    }

    if (alwaysMonoIcons.includes(name)) {
      type = 'mono';
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
export const getSvgSize = (size: IconSize) => {
  switch (size) {
    case 'xs':
      return 12;
    case 'sm':
      return 14;
    case 'md':
      return 16;
    case 'lg':
      return 18;
    case 'xl':
      return 24;
    case 'xxl':
      return 36;
    case 'xxxl':
      return 48;
  }
};
