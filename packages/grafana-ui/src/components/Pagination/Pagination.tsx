import React from 'react';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';
import { Button, ButtonVariant } from '../Button';
import { Icon } from '../Icon/Icon';

const PAGE_LENGTH_TO_CONDENSE = 8;

interface Props {
  /** The current page index being shown.  */
  currentPage: number;
  /** Number of total pages.  */
  numberOfPages: number;
  /** Callback function for fetching the selected page  */
  onNavigate: (toPage: number) => void;
}

export const Pagination: React.FC<Props> = ({ currentPage, numberOfPages, onNavigate }) => {
  const styles = getStyles();
  const pages = [...new Array(numberOfPages).keys()];

  const condensePages = numberOfPages > PAGE_LENGTH_TO_CONDENSE;
  const getListItem = (page: number, variant: 'primary' | 'secondary') => (
    <li key={page} className={styles.item}>
      <Button size="sm" variant={variant} onClick={() => onNavigate(page)}>
        {page}
      </Button>
    </li>
  );

  const pageButtons = pages.reduce<JSX.Element[]>((pagesToRender, pageIndex) => {
    const page = pageIndex + 1;
    const variant: ButtonVariant = page === currentPage ? 'primary' : 'secondary';

    // The indexes at which to start and stop condensing pages
    const lowerBoundIndex = PAGE_LENGTH_TO_CONDENSE;
    const upperBoundIndex = numberOfPages - PAGE_LENGTH_TO_CONDENSE + 1;
    // When the indexes overlap one another this number is negative
    const differenceOfBounds = upperBoundIndex - lowerBoundIndex;

    const isFirstOrLastPage = page === 1 || page === numberOfPages;
    // This handles when the lowerBoundIndex < currentPage < upperBoundIndex
    const currentPageIsBetweenBounds =
      differenceOfBounds > -1 && currentPage >= lowerBoundIndex && currentPage <= upperBoundIndex;

    if (condensePages) {
      if (
        isFirstOrLastPage ||
        (currentPage < lowerBoundIndex && page < lowerBoundIndex) ||
        (differenceOfBounds >= 0 && currentPage > upperBoundIndex && page > upperBoundIndex) ||
        (differenceOfBounds < 0 && currentPage >= lowerBoundIndex && page > upperBoundIndex) ||
        (currentPageIsBetweenBounds && page >= currentPage - 2 && page <= currentPage + 2)
      ) {
        // Renders a button for the page
        pagesToRender.push(getListItem(page, variant));
      } else if (
        (page === lowerBoundIndex && currentPage < lowerBoundIndex) ||
        (page === upperBoundIndex && currentPage > upperBoundIndex) ||
        (currentPageIsBetweenBounds && (page === currentPage - 3 || page === currentPage + 3))
      ) {
        // Renders and ellipsis to represent condensed pages
        pagesToRender.push(
          <li key={page} className={styles.item}>
            <Icon className={styles.ellipsis} name="ellipsis-v" />
          </li>
        );
      }
    } else {
      pagesToRender.push(getListItem(page, variant));
    }
    return pagesToRender;
  }, []);

  return (
    <div className={styles.container}>
      <ol>
        <li className={styles.item}>
          <Button
            aria-label="previous"
            size="sm"
            variant="secondary"
            onClick={() => onNavigate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Icon name="angle-left" />
          </Button>
        </li>
        {pageButtons}
        <li className={styles.item}>
          <Button
            aria-label="next"
            size="sm"
            variant="secondary"
            onClick={() => onNavigate(currentPage + 1)}
            disabled={currentPage === numberOfPages}
          >
            <Icon name="angle-right" />
          </Button>
        </li>
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
    ellipsis: css`
      transform: rotate(90deg);
    `,
  };
});
