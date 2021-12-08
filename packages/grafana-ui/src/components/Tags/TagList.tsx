import React, { FC, memo } from 'react';
import { css, cx } from '@emotion/css';
import { OnTagClick, Tag } from './Tag';
import { useTheme2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  tags: string[];
  isCompact?: boolean;
  onClick?: OnTagClick;
  /** Custom styles for the wrapper component */
  className?: string;
}

export const TagList: FC<Props> = memo(({ tags, onClick, className, isCompact }) => {
  const theme = useTheme2();
  const styles = getStyles(theme, isCompact);
  const numTags = tags.length;

  return (
    <span className={cx(styles.wrapper, className)}>
      {!isCompact && tags.map((tag) => <Tag key={tag} name={tag} onClick={onClick} className={styles.tag} />)}
      {isCompact && numTags > 0 && (
        <>
          <Tag key={tags[0]} name={tags[0]} onClick={onClick} className={styles.tag} />
          {numTags - 1 > 0 && <span className={styles.extraTags}>+ {numTags - 1}</span>}
        </>
      )}
    </span>
  );
});

TagList.displayName = 'TagList';

const getStyles = (theme: GrafanaTheme2, isCompact: Props['isCompact']) => {
  return {
    wrapper: css`
      align-items: ${isCompact ? 'center' : 'unset'};
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      flex-shrink: ${isCompact ? 0 : 1};
      justify-content: flex-end;
      gap: 6px;
    `,
    tag: css``,
    extraTags: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
    `,
  };
};
