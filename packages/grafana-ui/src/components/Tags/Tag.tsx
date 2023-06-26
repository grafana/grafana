import { cx, css } from '@emotion/css';
import React, { forwardRef, HTMLAttributes } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { getTagColor, getTagColorsFromName } from '../../utils';
import { Icon } from '../Icon/Icon';

/**
 * @public
 */
export type OnTagClick = (name: string, event: React.MouseEvent<HTMLElement>) => void;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  icon?: IconName;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling. */
  colorIndex?: number;
  onClick?: OnTagClick;
}

const TagComponent = forwardRef<HTMLElement, Props>(({ name, onClick, icon, className, colorIndex, ...rest }, ref) => {
  const theme = useTheme2();
  const styles = getTagStyles(theme, name, colorIndex);

  const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onClick?.(name, event);
  };

  const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

  return onClick ? (
    <button {...rest} className={classes} onClick={onTagClick} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
      {icon && <Icon name={icon} />}
      {name}
    </button>
  ) : (
    <span {...rest} className={classes} ref={ref}>
      {icon && <Icon name={icon} />}
      {name}
    </span>
  );
});
TagComponent.displayName = 'Tag';

const TagSkeleton = () => {
  const styles = useStyles2(getSkeletonStyles);
  return <Skeleton width={60} height={22} containerClassName={styles.container} />;
};

interface TagWithSkeleton extends React.ForwardRefExoticComponent<Props & React.RefAttributes<HTMLElement>> {
  Skeleton: typeof TagSkeleton;
}

export const Tag: TagWithSkeleton = Object.assign(TagComponent, {
  Skeleton: TagSkeleton,
});

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const getTagStyles = (theme: GrafanaTheme2, name: string, colorIndex?: number) => {
  let colors;
  if (colorIndex === undefined) {
    colors = getTagColorsFromName(name);
  } else {
    colors = getTagColor(colorIndex);
  }
  return {
    wrapper: css`
      appearance: none;
      border-style: none;
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.bodySmall.lineHeight};
      vertical-align: baseline;
      background-color: ${colors.color};
      color: ${theme.v1.palette.gray98};
      white-space: nowrap;
      text-shadow: none;
      padding: 3px 6px;
      border-radius: ${theme.shape.radius.default};
    `,
    hover: css`
      &:hover {
        opacity: 0.85;
        cursor: pointer;
      }
    `,
  };
};
