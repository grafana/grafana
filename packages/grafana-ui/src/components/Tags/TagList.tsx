import { css, cx } from '@emotion/css';
import { forwardRef, memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { SkeletonComponent, attachSkeleton } from '../../utils/skeleton';

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
        <ul className={cx(styles.wrapper, className)} aria-label={t('grafana-ui.tags.list-label', 'Tags')} ref={ref}>
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
            <li className={styles.li}>
              <span className={styles.moreTagsLabel}>
                {'+ '}
                {numTags - displayMax}
              </span>
            </li>
          )}
        </ul>
      );
    }
  )
);
TagListComponent.displayName = 'TagList';

const TagListSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.container} {...rootProps}>
      <Tag.Skeleton />
      <Tag.Skeleton />
    </div>
  );
};

export const TagList = attachSkeleton(TagListComponent, TagListSkeleton);

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});

const getStyles = (theme: GrafanaTheme2, isTruncated: boolean) => {
  return {
    wrapper: css({
      position: 'relative',
      alignItems: isTruncated ? 'center' : 'unset',
      display: 'flex',
      flex: '1 1 auto',
      flexWrap: 'wrap',
      flexShrink: isTruncated ? 0 : 1,
      justifyContent: 'flex-end',
      gap: '6px',
    }),
    moreTagsLabel: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    }),
    li: css({
      listStyle: 'none',
    }),
  };
};
