import { css, cx } from '@emotion/css';
import { cloneElement, memo, forwardRef } from 'react';

import { type GrafanaTheme2, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName, type IconType, type IconSize } from '../../types/icon';
import { spin } from '../../utils/keyframes';

import { useSvgElement } from './useSvgElement';
import { getIconPath, getSvgSize } from './utils';

export interface IconProps extends Omit<React.SVGProps<SVGElement>, 'onLoad' | 'onError' | 'ref'> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
  /**
   * Give your icon a semantic meaning. The icon will be hidden from screen readers, unless this prop or an aria-label is provided.
   */
  title?: string;
}

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
    spin: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${spin} 2s infinite linear`,
      },
    }),
  };
};

/**
 * Grafana's icon wrapper component.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/iconography-icon--docs
 */
export const Icon = memo(
  forwardRef<SVGElement, IconProps>(
    ({ size = 'md', type = 'default', name, className, style, title = '', ...rest }, ref) => {
      const styles = useStyles2(getIconStyles);

      if (!isIconName(name)) {
        console.warn('Icon component passed an invalid icon name', name);
      }

      // handle the deprecated 'fa fa-spinner'
      const iconName: IconName = name === 'fa fa-spinner' ? 'spinner' : name;

      const svgSize = getSvgSize(size);
      const svgHgt = svgSize;
      const svgWid = name.startsWith('gf-bar-align') ? 16 : name.startsWith('gf-interp') ? 30 : svgSize;
      const svgPath = getIconPath(iconName, type);

      const { element, isLoading } = useSvgElement(svgPath);

      const composedClassName = cx(
        styles.icon,
        className,
        type === 'mono' ? { [styles.orange]: name === 'favorite' } : '',
        {
          [styles.spin]: iconName === 'spinner',
        }
      );

      if (!element) {
        // render an empty element with the correct dimensions while loading
        // this prevents content layout shift whilst the icon asynchronously loads
        return isLoading ? (
          <svg
            className={cx(
              css({
                width: svgWid,
                height: svgHgt,
              }),
              composedClassName
            )}
          />
        ) : null;
      }

      const iconProps = {
        'data-testid': `icon-${iconName}`,
        'aria-hidden':
          rest.tabIndex === undefined &&
          !title &&
          !rest['aria-label'] &&
          !rest['aria-labelledby'] &&
          !rest['aria-describedby'],
        ref,
        width: svgWid,
        height: svgHgt,
        className: composedClassName,
        style,
        ...rest,
      };

      // The title has to be a child of the SVG rather than an attribute for it to be announced,
      // and it's per-instance, so it can't be baked into the shared cached element.
      return title
        ? cloneElement(element, iconProps, <title key="icon-title">{title}</title>, element.props.children)
        : cloneElement(element, iconProps);
    }
  )
);

Icon.displayName = 'Icon';
