import { css, cx } from '@emotion/css';
import React, { Suspense } from 'react';
import { convertFromString } from 'react-from-dom';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName, IconSize, IconType } from '../../types/icon';

import { getIconSubDir, getSvgSize } from './utils';

/**
 * Construct a context bundle from all the svg icons in the public/img/icons folder.
 * See https://webpack.js.org/guides/dependency-management/
 */
const iconBundle = require.context('../../../../../public/img/icons/', true, /\.svg$/, 'lazy-once');

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
  title?: string;
}

const getIconStyles = (theme: GrafanaTheme2) => {
  return {
    // line-height: 0; is needed for correct icon alignment in Safari
    container: css`
      label: Icon;
      display: inline-block;
      line-height: 0;
    `,
    icon: css`
      vertical-align: middle;
      display: inline-block;
      fill: currentColor;
    `,
    orange: css`
      fill: ${theme.v1.palette.orange};
    `,
  };
};

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, title = '', ...divElementProps }, ref) => {
    const styles = useStyles2(getIconStyles);

    /* Temporary solution to display also font awesome icons */
    if (name?.startsWith('fa fa-')) {
      return <i className={getFontAwesomeIconStyles(name, className)} {...divElementProps} style={style} />;
    }

    if (name === 'panel-add') {
      size = 'xl';
    }

    const svgSize = getSvgSize(size);
    const svgWid = name?.startsWith('gf-bar-align') ? 16 : name?.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(name, type);
    const svgBundlePath = `./${subDir}/${name}.svg`;

    const IconLazy = React.lazy(async () => {
      const content = await iconBundle(svgBundlePath);
      const svgElement = convertFromString(content);
      const svg = React.isValidElement(svgElement)
        ? React.cloneElement(svgElement, {
            width: svgWid,
            height: svgSize,
            title,
            className: cx(styles.icon, className, type === 'mono' ? { [styles.orange]: name === 'favorite' } : ''),
            style,
          })
        : '';
      return {
        default: () => {
          return (
            <div className={styles.container} {...divElementProps} ref={ref}>
              {svg}
            </div>
          );
        },
      };
    });

    return (
      <Suspense fallback={<div></div>}>
        <IconLazy />
      </Suspense>
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
