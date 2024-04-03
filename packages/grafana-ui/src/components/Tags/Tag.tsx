import { cx, css } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { getTagColor, getTagColorsFromName } from '../../utils';
import { SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  icon?: IconName;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling. */
  colorIndex?: number;
  onClick?: OnTagClick;
  value?: string | number | ReactNode;
}

/**
 * @public
 */
export type OnTagClick = (name: Props['name'], event: React.MouseEvent<HTMLElement>) => void;

const TagComponent = forwardRef<HTMLButtonElement | HTMLDivElement, Props>(
  ({ name, onClick, icon, className, colorIndex, value, ...rest }, ref) => {
    const theme = useTheme2();
    const styles = getTagStyles(theme, name, colorIndex, value);

    const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      onClick?.(name, event);
    };

    const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

    const valueToDisplay = value ? <div className={styles.value}>{value}</div> : null;

    const contents = (
      <Stack gap={0} justifyContent={'center'}>
        <div className={styles.name}>
          {icon && <Icon name={icon} />}
          {name}
        </div>
        {valueToDisplay}
      </Stack>
    );

    return onClick ? (
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      <button {...rest} className={classes} onClick={onTagClick} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
        {contents}
      </button>
    ) : (
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      <div {...rest} className={classes} ref={ref as React.ForwardedRef<HTMLDivElement>}>
        {contents}
      </div>
    );
  }
);
TagComponent.displayName = 'Tag';

const TagSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return <Skeleton width={60} height={22} containerClassName={styles.container} {...rootProps} />;
};

export const Tag = attachSkeleton(TagComponent, TagSkeleton);

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const adjustColor = (color: string, isDark: boolean) => {
  const tinycolor = tinycolor2(color);
  return isDark ? tinycolor.darken(5).toString() : tinycolor.lighten(5).toString();
};

const getTagStyles = (theme: GrafanaTheme2, name: Props['value'], colorIndex?: number, value?: Props['value']) => {
  const { color, borderColor } =
    colorIndex === undefined ? getTagColorsFromName(String(name)) : getTagColor(colorIndex);
  const valueBackgroundColor = adjustColor(color, theme.isDark);

  return {
    wrapper: css({
      display: 'inline-block',
      appearance: 'none',
      borderStyle: 'none',
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      verticalAlign: 'baseline',
      backgroundColor: color,
      color: '#fff',
      textShadow: 'none',
      borderRadius: theme.shape.radius.default,
      border: value ? `solid 1px ${borderColor}` : 'none',
      padding: 0,
    }),
    name: css({
      padding: theme.spacing(0.25, 0.5),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    value: css({
      padding: theme.spacing(0.25, 0.5),
      backgroundColor: valueBackgroundColor,
      borderLeft: `1px solid ${borderColor}`,
      width: '100%',
      justifyContent: 'center',
    }),
    hover: css({
      '&:hover': {
        opacity: 0.85,
        cursor: 'pointer',
      },
    }),
  };
};
