import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes/stylesFactory';
import { useTheme } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types/icon';
import SVG from '@leeoniya/react-inlinesvg';
import { cacheInitialized, initIconCache, iconRoot } from './iconBundle';

const alwaysMonoIcons: IconName[] = ['grafana', 'favorite', 'heart-break', 'heart', 'panel-add', 'reusable-panel'];

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
}

const getIconStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      label: Icon;
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

function getIconSubDir(name: IconName, type: string): string {
  return name?.startsWith('gf-')
    ? 'custom'
    : alwaysMonoIcons.includes(name)
    ? 'mono'
    : type === 'default'
    ? 'unicons'
    : 'mono';
}

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, ...divElementProps }, ref) => {
    const theme = useTheme();

    /* Temporary solution to display also font awesome icons */
    if (name?.startsWith('fa fa-')) {
      return <i className={getFontAwesomeIconStyles(name, className)} {...divElementProps} style={style} />;
    }

    if (name === 'panel-add') {
      size = 'xl';
    }

    if (!cacheInitialized) {
      initIconCache();
    }

    const styles = getIconStyles(theme);
    const svgSize = getSvgSize(size);
    const svgHgt = svgSize;
    const svgWid = name?.startsWith('gf-bar-align') ? 16 : name?.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(name, type);
    const svgPath = `${iconRoot}${subDir}/${name}.svg`;

    return (
      <div className={styles.container} {...divElementProps} ref={ref}>
        <SVG
          src={svgPath}
          width={svgWid}
          height={svgHgt}
          className={cx(styles.icon, className, type === 'mono' ? { [styles.orange]: name === 'favorite' } : '')}
          style={style}
        />
      </div>
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
