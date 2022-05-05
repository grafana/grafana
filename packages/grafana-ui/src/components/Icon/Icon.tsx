import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme } from '@grafana/data';

import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { IconName, IconType, IconSize } from '../../types/icon';

import { cacheInitialized, initIconCache, iconRoot } from './iconBundle';
import { getIconSubDir, getSvgSize } from './utils';

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
  title?: string;
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

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...divElementProps }, ref) => {
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
          title={title}
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
