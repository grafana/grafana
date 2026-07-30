import { css, cx } from '@emotion/css';
import { forwardRef, memo, useEffect, useState } from 'react';

import { type GrafanaTheme2, type IconName, isIconName } from '@grafana/data';
import { ICON_STROKE_WIDTHS, type SVGComponent } from '@grafana/icons';

import { useStyles2 } from '../../themes/ThemeContext';
import { spin } from '../../utils/keyframes';

import { type IconProps } from './Icon';
import { iconLoaders } from './iconLoaders.gen';
import { getSvgSize } from './utils';

// Each icon lives in its own async chunk, so resolved components are cached at
// module scope: an icon that has loaded once renders synchronously everywhere
// after, including across remounts.
const resolvedIcons = new Map<IconName, SVGComponent>();

/**
 * Seeds the resolved-icon cache so those icons render synchronously on first
 * paint, with no async state update.
 *
 * The test environment uses this: an async update inside `Icon` would otherwise
 * make every test that renders an icon emit a React `act()` warning, which
 * Grafana's setup treats as a failure.
 */
export function seedResolvedIcons(entries: Iterable<readonly [string, SVGComponent]>) {
  for (const [name, component] of entries) {
    if (isIconName(name)) {
      resolvedIcons.set(name, component);
    }
  }
}

function useResolvedIcon(name: IconName): SVGComponent | undefined {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (resolvedIcons.has(name)) {
      return;
    }

    // Plugins can pass a name outside IconName. Match the legacy path and render
    // the empty placeholder rather than throwing on a missing loader.
    const load = iconLoaders[name];
    if (!load) {
      return;
    }

    // Guards against `name` changing while a chunk is in flight. The resolved
    // component is always cached, but only the effect still describing the
    // current name is allowed to trigger a re-render.
    let active = true;

    load()
      .then((component) => {
        resolvedIcons.set(name, component);
        if (active) {
          forceUpdate((version) => version + 1);
        }
      })
      .catch(() => {
        // Keep the sized placeholder rather than collapsing the layout around a
        // chunk that failed to load.
      });

    return () => {
      active = false;
    };
  }, [name]);

  return resolvedIcons.get(name);
}

const getDynamicIconStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      display: 'inline-block',
      flexShrink: 0,
      label: 'Icon',
      // line-height: 0; is needed for correct icon alignment in Safari
      lineHeight: 0,
      verticalAlign: 'middle',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    // @grafana/icons ships the raw SVG paths unstyled and expects the consumer to
    // pick stroke-vs-fill, so this mirrors its own wrapper's styling.
    outline: css({
      fill: 'none',
      stroke: 'currentColor',
    }),
    solid: css({
      fill: 'currentColor',
      stroke: 'none',
    }),
    spin: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${spin} 2s infinite linear`,
      },
    }),
  };
};

/**
 * Renders a Grafana icon name using @grafana/icons, resolving the name to a
 * lazily-loaded component. Keeps `Icon`'s prop surface — including arbitrary SVG
 * props and the `icon-<name>` test id — which @grafana/icons' own wrapper drops.
 *
 * Known gap: `ref` is not forwarded to the loaded icon. @grafana/icons' generated
 * components are plain function components, so on React 18 a ref passed to them
 * is dropped with a warning.
 */
export const DynamicIcon = memo(
  forwardRef<SVGSVGElement, IconProps>(
    ({ size = 'md', type, name: nameProp, className, style, title = '', ...rest }, ref) => {
      const styles = useStyles2(getDynamicIconStyles);

      if (!isIconName(nameProp)) {
        console.warn('Icon component passed an invalid icon name', nameProp);
      }

      // handle the deprecated 'fa fa-spinner'
      const name: IconName = nameProp === 'fa fa-spinner' ? 'spinner' : nameProp;

      const Component = useResolvedIcon(name);
      const svgSize = getSvgSize(size);

      const composedClassName = cx(
        styles.icon,
        Component?.fill === 'solid' ? styles.solid : styles.outline,
        {
          [styles.spin]: name === 'spinner',
        },
        className
      );

      const svgProps = {
        'data-testid': `icon-${name}`,
        'aria-hidden':
          rest.tabIndex === undefined &&
          !title &&
          !rest['aria-label'] &&
          !rest['aria-labelledby'] &&
          !rest['aria-describedby'],
        width: svgSize,
        height: svgSize,
        className: composedClassName,
        style,
      };

      if (!Component) {
        // Render an empty element with the correct dimensions while the icon's
        // chunk loads, so the surrounding layout doesn't shift when it arrives.
        return <svg ref={ref} {...svgProps} {...rest} />;
      }

      return <Component {...svgProps} strokeWidth={ICON_STROKE_WIDTHS[size]} title={title} {...rest} />;
    }
  )
);

DynamicIcon.displayName = 'DynamicIcon';
