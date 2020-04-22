import React from 'react';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';
import { Button, ButtonVariant } from '../Button';

interface Props {
  currentPage: number;
  numberOfPages: number;
  onNavigate: (toPage: number) => void;
}

export const Pagination: React.FC<Props> = ({ currentPage, numberOfPages, onNavigate }) => {
  const styles = getStyles();
  const pages = [...new Array(numberOfPages).keys()];

  return (
    <div className={styles.container}>
      <ol>
        {pages.map(pageIndex => {
          const page = pageIndex + 1;
          const variant: ButtonVariant = page === currentPage ? 'primary' : 'secondary';

          return (
            <li key={page} className={styles.item}>
              <Button size="sm" variant={variant} onClick={() => onNavigate(page)}>
                {page}
              </Button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const getStyles = stylesFactory(() => {
  return {
    container: css`
      float: right;
    `,
    item: css`
      display: inline-block;
      padding-left: 10px;
      margin-bottom: 5px;
    `,
  };
});
