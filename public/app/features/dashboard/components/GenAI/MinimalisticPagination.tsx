import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface MinimalisticPaginationProps {
  currentPage: number;
  numberOfPages: number;
  onNavigate: (toPage: number) => void;
  hideWhenSinglePage?: boolean;
  className?: string;
}

export const MinimalisticPagination = ({
  currentPage,
  numberOfPages,
  onNavigate,
  hideWhenSinglePage,
  className,
}: MinimalisticPaginationProps) => {
  const styles = useStyles2(getStyles);

  if (hideWhenSinglePage && numberOfPages <= 1) {
    return null;
  }

  return (
    <div className={cx(styles.wrapper, className)}>
      <IconButton
        name="angle-left"
        size="md"
        tooltip={t('dashboard.minimalistic-pagination.tooltip-previous', 'Previous')}
        onClick={() => onNavigate(currentPage - 1)}
        disabled={currentPage === 1}
      />
      {currentPage} of {numberOfPages}
      <IconButton
        name="angle-right"
        size="md"
        tooltip={t('dashboard.minimalistic-pagination.tooltip-next', 'Next')}
        onClick={() => onNavigate(currentPage + 1)}
        disabled={currentPage === numberOfPages}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    userSelect: 'none',
  }),
});
