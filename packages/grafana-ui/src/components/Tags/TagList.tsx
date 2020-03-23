import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { Tag } from './Tag';

export interface Props {
  tags: string[];
  onClick?: (name: string) => any;
  /** Custom styles for the wrapper component */
  className?: string;
}

export const TagList: FC<Props> = ({ tags, onClick, className }) => {
  const styles = getStyles();

  return (
    <span className={cx(styles.wrapper, className)}>
      {tags.map(tag => (
        <Tag key={tag} name={tag} onClick={onClick} className={styles.tag} />
      ))}
    </span>
  );
};

const getStyles = () => {
  return {
    wrapper: css`
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      padding: 10px;
    `,
    tag: css`
      margin-left: 6px;
      font-size: 11px;
      padding: 2px 6px;
    `,
  };
};
