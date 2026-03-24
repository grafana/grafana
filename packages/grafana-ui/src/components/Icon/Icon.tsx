import { css, cx } from '@emotion/css';
import { useCallback, useState, useRef, memo, forwardRef } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types/icon';
import { spin } from '../../utils/keyframes';

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

// The SVG can become 'stuck' if it's changed quickly before the previous icon finished loading.
// See https://github.com/gilbarbara/react-inlinesvg/issues/247
// By using the svgPath as the key, we ensure that the component is re-mounted and the new icon is loaded correctly.
function useIconWorkaround(name: IconName) {
  // Buffer name changes while the icon is loading until it stops loading, then apply the most recent name change.
  // We use refs for state and a forceUpdate state to avoid needing to use the buffered name in the happy path
  // of when the icon changes when its not currently loading.
  // We want to avoid needless state updates to keep track of the lifecycle.

  const [, setForceUpdate] = useState(0);
  const isLoadingRef = useRef(false);
  const currentNameRef = useRef(name);
  const bufferedNameRef = useRef<IconName | null>(null);

  // Decide which name to render THIS render
  let nameToUse = name;

  if (isLoadingRef.current && name !== currentNameRef.current) {
    // Currently loading and name changed - buffer it, keep using current
    nameToUse = currentNameRef.current;
    bufferedNameRef.current = name;
  } else if (!isLoadingRef.current && name !== currentNameRef.current) {
    // Not loading - use new name immediately (happy path)
    currentNameRef.current = name;
    bufferedNameRef.current = null;
    isLoadingRef.current = true; // Mark as loading when we accept a new name
  }

  const handleLoad = useCallback(() => {
    isLoadingRef.current = false;

    // Apply buffered name if one exists
    if (bufferedNameRef.current) {
      currentNameRef.current = bufferedNameRef.current;
      bufferedNameRef.current = null;
      setForceUpdate((n) => n + 1); // Trigger re-render with buffered name
    }
  }, []);

  return { nameToUse, handleLoad };
}

/**
 * Grafana's icon wrapper component.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/iconography-icon--docs
 */
export const Icon = memo(
  forwardRef<SVGElement, IconProps>(
    ({ size = 'md', type = 'default', name: nameProp, className, style, title = '', ...rest }, ref) => {
      const styles = useStyles2(getIconStyles);
      const { nameToUse: name, handleLoad } = useIconWorkaround(nameProp);

      if (!isIconName(name)) {
        console.warn('Icon component passed an invalid icon name', name);
      }

      // handle the deprecated 'fa fa-spinner'
      const iconName: IconName = name === 'fa fa-spinner' ? 'spinner' : name;

      const svgSize = getSvgSize(size);
      const svgHgt = svgSize;
      const svgWid = name.startsWith('gf-bar-align') ? 16 : name.startsWith('gf-interp') ? 30 : svgSize;
      const svgPath = getIconPath(iconName, type);

      const composedClassName = cx(
        styles.icon,
        className,
        type === 'mono' ? { [styles.orange]: name === 'favorite' } : '',
        {
          [styles.spin]: iconName === 'spinner',
        }
      );

      return (
        <SVG
          data-testid={`icon-${iconName}`}
          aria-hidden={
            rest.tabIndex === undefined &&
            !title &&
            !rest['aria-label'] &&
            !rest['aria-labelledby'] &&
            !rest['aria-describedby']
          }
          onLoad={handleLoad}
          onError={handleLoad}
          innerRef={ref}
          src={svgPath}
          width={svgWid}
          height={svgHgt}
          title={title}
          className={composedClassName}
          style={style}
          // render an empty element with the correct dimensions while loading
          // this prevents content layout shift whilst the icon asynchronously loads
          // which happens even if the icon is in the cache(!)
          loader={
            <svg
              className={cx(
                css({
                  width: svgWid,
                  height: svgHgt,
                }),
                composedClassName
              )}
            />
          }
          {...rest}
        />
      );
    }
  )
);

Icon.displayName = 'Icon';
