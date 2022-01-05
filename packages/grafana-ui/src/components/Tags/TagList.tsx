import React, { FC, memo } from 'react';
import { css, cx } from '@emotion/css';
import { OnTagClick, Tag } from './Tag';
import { useTheme2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  displayMax?: number;
  tags: string[];
  onClick?: OnTagClick;
  /** Custom styles for the wrapper component */
  className?: string;
}

export const TagList: FC<Props> = memo(({ displayMax, tags, onClick, className }) => {
  const theme = useTheme2();
  const styles = getStyles(theme, Boolean(displayMax && displayMax > 0));
  const numTags = tags.length;
  const tagsToDisplay = displayMax ? tags.slice(0, displayMax) : tags;

  return (
    <span className={cx(styles.wrapper, className)}>
      {tagsToDisplay.map((tag) => (
        <Tag key={tag} name={tag} onClick={onClick} />
      ))}
      {displayMax && displayMax > 0 && numTags - 1 > 0 && <span className={styles.moreTagsLabel}>+ {numTags - 1}</span>}
    </span>
  );
});

TagList.displayName = 'TagList';

const getStyles = (theme: GrafanaTheme2, isTruncated: boolean) => {
  return {
    wrapper: css`
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
  };
};
