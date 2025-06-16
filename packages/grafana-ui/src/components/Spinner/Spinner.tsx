import { cx, css } from '@emotion/css';
import * as React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconSize, isIconSize } from '../../types/icon';
import { spin } from '../../utils/keyframes';
import { Icon } from '../Icon/Icon';
import { getIconRoot, getIconSubDir } from '../Icon/utils';

export interface Props {
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  inline?: boolean;
  size?: IconSize;
}

/**
 * @deprecated
 * use a predefined size, e.g. 'md' or 'lg' instead
 */
interface PropsWithDeprecatedSize extends Omit<Props, 'size'> {
  size?: number | string;
}

/**
 * @public
 */
export const Spinner = ({
  className,
  inline = false,
  iconClassName,
  style,
  size = 'md',
}: Props | PropsWithDeprecatedSize) => {
  const styles = useStyles2(getStyles);

  const deprecatedStyles = useStyles2(getDeprecatedStyles, size);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const iconName = prefersReducedMotion ? 'hourglass' : 'spinner';

  // this entire if statement is handling the deprecated size prop
  // TODO remove once we fully remove the deprecated type
  if (typeof size !== 'string' || !isIconSize(size)) {
    const iconRoot = getIconRoot();
    const subDir = getIconSubDir(iconName, 'default');
    const svgPath = `${iconRoot}${subDir}/${iconName}.svg`;
    return (
      <div
        data-testid="Spinner"
        style={style}
        className={cx(
          {
            [styles.inline]: inline,
          },
          deprecatedStyles.wrapper,
          className
        )}
      >
        <SVG
          src={svgPath}
          width={size}
          height={size}
          className={cx(styles.spin, deprecatedStyles.icon, className)}
          style={style}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="Spinner"
      style={style}
      className={cx(
        {
          [styles.inline]: inline,
        },
        className
      )}
    >
      <Icon
        className={cx(styles.spin, iconClassName)}
        name={iconName}
        size={size}
        aria-label={t('grafana-ui.spinner.aria-label', 'Loading')}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  inline: css({
    display: 'inline-block',
    lineHeight: 0,
  }),
  spin: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${spin} 2s infinite linear`,
    },
  }),
});

// TODO remove once we fully remove the deprecated type
const getDeprecatedStyles = (theme: GrafanaTheme2, size: number | string) => ({
  wrapper: css({
    fontSize: typeof size === 'string' ? size : `${size}px`,
  }),
  icon: css({
    display: 'inline-block',
    fill: 'currentColor',
    flexShrink: 0,
    label: 'Icon',
    // line-height: 0; is needed for correct icon alignment in Safari
    lineHeight: 0,
    verticalAlign: 'middle',
  }),
});
