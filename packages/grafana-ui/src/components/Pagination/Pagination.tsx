import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';

import { useStyles2 } from '../../themes';
import { Button, ButtonVariant } from '../Button';
import { Icon } from '../Icon/Icon';

export interface Props {
  /** The current page index being shown. */
  currentPage: number;
  /** Number of total pages. */
  numberOfPages: number;
  /** Callback function for fetching the selected page.  */
  onNavigate: (toPage: number) => void;
  /** When set to true and the pagination result is only one page it will not render the pagination at all. */
  hideWhenSinglePage?: boolean;
  /** Small version only shows the current page and the navigation buttons. */
  showSmallVersion?: boolean;
  className?: string;
}

export const Pagination = ({
  currentPage,
  numberOfPages,
  onNavigate,
  hideWhenSinglePage,
  showSmallVersion,
  className,
}: Props) => {
  const styles = useStyles2(getStyles);
  const pageLengthToCondense = showSmallVersion ? 1 : 8;

  const pageButtons = useMemo(() => {
    const pages = [...new Array(numberOfPages).keys()];

    const condensePages = numberOfPages > pageLengthToCondense;
    const getListItem = (page: number, variant: 'primary' | 'secondary') => (
      <li key={page} className={styles.item}>
        <Button size="sm" variant={variant} onClick={() => onNavigate(page)}>
          {page}
        </Button>
      </li>
    );

    return pages.reduce<JSX.Element[]>((pagesToRender, pageIndex) => {
      const page = pageIndex + 1;
      const variant: ButtonVariant = page === currentPage ? 'primary' : 'secondary';

      // The indexes at which to start and stop condensing pages
      const lowerBoundIndex = pageLengthToCondense;
      const upperBoundIndex = numberOfPages - pageLengthToCondense + 1;
      // When the indexes overlap one another this number is negative
      const differenceOfBounds = upperBoundIndex - lowerBoundIndex;

      const isFirstOrLastPage = page === 1 || page === numberOfPages;
      // This handles when the lowerBoundIndex < currentPage < upperBoundIndex
      const currentPageIsBetweenBounds =
        differenceOfBounds > -1 && currentPage >= lowerBoundIndex && currentPage <= upperBoundIndex;

      // Show ellipsis after that many pages
      const ellipsisOffset = showSmallVersion ? 1 : 3;

      // The offset to show more pages when currentPageIsBetweenBounds
      const pageOffset = showSmallVersion ? 0 : 2;

      if (condensePages) {
        if (
          isFirstOrLastPage ||
          (currentPage < lowerBoundIndex && page < lowerBoundIndex) ||
          (differenceOfBounds >= 0 && currentPage > upperBoundIndex && page > upperBoundIndex) ||
          (differenceOfBounds < 0 && currentPage >= lowerBoundIndex && page > upperBoundIndex) ||
          (currentPageIsBetweenBounds && page >= currentPage - pageOffset && page <= currentPage + pageOffset)
        ) {
          // Renders a button for the page
          pagesToRender.push(getListItem(page, variant));
        } else if (
          (page === lowerBoundIndex && currentPage < lowerBoundIndex) ||
          (page === upperBoundIndex && currentPage > upperBoundIndex) ||
          (currentPageIsBetweenBounds &&
            (page === currentPage - ellipsisOffset || page === currentPage + ellipsisOffset))
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
  }, [currentPage, numberOfPages, onNavigate, pageLengthToCondense, showSmallVersion, styles.ellipsis, styles.item]);

  if (hideWhenSinglePage && numberOfPages <= 1) {
    return null;
  }

  return (
    <div className={cx(styles.container, className)}>
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

const getStyles = () => {
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
};
