import React, { FC, memo } from 'react';
import { css, cx } from '@emotion/css';
import { OnTagClick, Tag } from './Tag';

export interface Props {
  tags: string[];
  onClick?: OnTagClick;
  /** Custom styles for the wrapper component */
  className?: string;
  'aria-label'?: string | ((name: string, i: number) => string);
}

export const TagList: FC<Props> = memo(({ tags, onClick, className, 'aria-label': ariaLabel }) => {
  const styles = getStyles();

  return (
    <ul className={cx(styles.wrapper, className)} aria-label="Tags">
      {tags.map((tag, i) => (
        <li className={styles.li} key={tag}>
          <Tag
            name={tag}
            onClick={onClick}
            className={styles.tag}
            aria-label={typeof ariaLabel === 'string' ? ariaLabel : ariaLabel?.(tag, i)}
          />
        </li>
      ))}
    </ul>
  );
});

TagList.displayName = 'TagList';

const getStyles = () => {
  return {
    wrapper: css({
      display: 'flex',
      position: 'relative',
      flex: '1 1 auto',
      flexWrap: 'wrap',
      marginBottom: '-6px',
      justifyContent: 'flex-end',
    }),
    tag: css({
      margin: '0 0 6px 6px',
    }),
    li: css({
      listStyle: 'none',
    }),
  };
};
