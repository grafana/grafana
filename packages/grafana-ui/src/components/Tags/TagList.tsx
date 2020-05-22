import React, { FC, memo } from 'react';
import { cx, css } from 'emotion';
import { OnTagClick, Tag } from './Tag';

export interface Props {
  tags: string[];
  onClick?: OnTagClick;
  /** Custom styles for the wrapper component */
  className?: string;
}

export const TagList: FC<Props> = memo(({ tags, onClick, className }) => {
  const styles = getStyles();

  return (
    <span className={cx(styles.wrapper, className)}>
      {tags.map(tag => (
        <Tag key={tag} name={tag} onClick={onClick} className={styles.tag} />
      ))}
    </span>
  );
});

const getStyles = () => {
  return {
    wrapper: css`
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
    `,
    tag: css`
      margin-left: 6px;
    `,
  };
};
