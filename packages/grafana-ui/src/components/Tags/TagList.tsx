import { css, cx } from '@emotion/css';
import React, { forwardRef, memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';

import { OnTagClick, Tag } from './Tag';

export interface Props {
  /** Maximum number of the tags to display */
  displayMax?: number;
  /** Names of the tags to display */
  tags: string[];
  /** Callback when the tag is clicked */
  onClick?: OnTagClick;
  /** Custom styles for the wrapper component */
  className?: string;
  /** aria-label for the `i`-th Tag component */
  getAriaLabel?: (name: string, i: number) => string;
  //** Should return an index of a color defined in the TAG_COLORS array */
  getColorIndex?: (name: string, i: number) => number;
  /** Icon to show next to tag label */
  icon?: IconName;
}

const TagListComponent = memo(
  forwardRef<HTMLUListElement, Props>(
    ({ displayMax, tags, icon, onClick, className, getAriaLabel, getColorIndex }, ref) => {
      const theme = useTheme2();
      const styles = getStyles(theme, Boolean(displayMax && displayMax > 0));
      const numTags = tags.length;
      const tagsToDisplay = displayMax ? tags.slice(0, displayMax) : tags;
      return (
        <ul className={cx(styles.wrapper, className)} aria-label="Tags" ref={ref}>
          {tagsToDisplay.map((tag, i) => (
            <li className={styles.li} key={tag}>
              <Tag
                name={tag}
                icon={icon}
                onClick={onClick}
                aria-label={getAriaLabel?.(tag, i)}
                data-tag-id={i}
                colorIndex={getColorIndex?.(tag, i)}
              />
            </li>
          ))}
          {displayMax && displayMax > 0 && numTags - displayMax > 0 && (
            <span className={styles.moreTagsLabel}>+ {numTags - displayMax}</span>
          )}
        </ul>
      );
    }
  )
);
TagListComponent.displayName = 'TagList';

const TagListSkeleton = () => {
  const styles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.container}>
      <Tag.Skeleton />
      <Tag.Skeleton />
    </div>
  );
};

interface TagListWithSkeleton extends React.ForwardRefExoticComponent<Props & React.RefAttributes<HTMLUListElement>> {
  Skeleton: typeof TagListSkeleton;
}

export const TagList: TagListWithSkeleton = Object.assign(TagListComponent, {
  Skeleton: TagListSkeleton,
});

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});

const getStyles = (theme: GrafanaTheme2, isTruncated: boolean) => {
  return {
    wrapper: css`
      position: relative;
      align-items: ${isTruncated ? 'center' : 'unset'};
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      flex-shrink: ${isTruncated ? 0 : 1};
      justify-content: flex-end;
      gap: 6px;
    `,
    moreTagsLabel: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
    `,
    li: css({
      listStyle: 'none',
    }),
  };
};
