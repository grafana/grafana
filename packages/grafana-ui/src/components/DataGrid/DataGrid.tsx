import 'react-data-grid/lib/styles.css';

import { css } from '@emotion/css';
import clsx from 'clsx';
import { ComponentProps, ReactNode, useState } from 'react';
import { DataGrid as RDG } from 'react-data-grid';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Pagination } from '../Pagination/Pagination';

interface DataGridPaginationProps {
  numPages: number;
  numRows: number;
  pageRowStart: number;
  pageRowEnd: number;
  onPageChange?: (pageIndex: number) => void;
  initialPage?: number;
  small?: boolean;
}

export interface DataGridProps<R, SR> extends ComponentProps<typeof RDG<R, SR>> {
  transparent?: boolean;
  pagination?: DataGridPaginationProps;
  hideHeader?: boolean;
}

const PaginatedDataGrid = ({
  children,
  numPages,
  numRows,
  pageRowStart,
  pageRowEnd,
  onPageChange,
  initialPage = 1,
  small,
}: DataGridPaginationProps & { children: ReactNode }) => {
  const styles = useStyles2(getPaginationStyles);
  const [page, setPage] = useState(initialPage);
  return (
    <>
      {children}
      <div className={styles.container}>
        <Pagination
          className="table-ng-pagination"
          currentPage={page}
          numberOfPages={numPages}
          showSmallVersion={small}
          onNavigate={(toPage) => {
            onPageChange?.(toPage);
            setPage(toPage);
          }}
        />
        {!small && (
          <div className={styles.summary}>
            <Trans i18nKey="grafana-ui.data-grid.pagination-summary">
              {{ pageRowStart }} - {{ pageRowEnd }} of {{ numRows }} rows
            </Trans>
          </div>
        )}
      </div>
    </>
  );
};

export function DataGrid<R, SR>({
  pagination,
  transparent,
  hideHeader,
  className,
  headerRowClass,
  ...props
}: DataGridProps<R, SR>) {
  const styles = useStyles2(getStyles, Boolean(pagination), transparent, hideHeader);

  let content = (
    <RDG<R, SR>
      className={clsx(styles.container, className)}
      headerRowClass={clsx(styles.header, headerRowClass)}
      {...props}
    />
  );

  if (pagination) {
    content = <PaginatedDataGrid {...pagination}>{content}</PaginatedDataGrid>;
  }

  return content;
}

const getStyles = (theme: GrafanaTheme2, enablePagination?: boolean, transparent?: boolean, hideHeader?: boolean) => {
  const bgColor = transparent ? theme.colors.background.canvas : theme.colors.background.primary;
  // this needs to be pre-calc'd since the theme colors have alpha and the border color becomes
  // unpredictable for background color cells
  const borderColor = colorManipulator.onBackground(theme.colors.border.weak, bgColor).toHexString();

  return {
    container: css({
      '--rdg-background-color': bgColor,
      '--rdg-header-background-color': bgColor,
      '--rdg-border-color': borderColor,
      '--rdg-color': theme.colors.text.primary,
      '--rdg-summary-border-color': borderColor,
      '--rdg-summary-border-width': '1px',

      '--rdg-selection-color': theme.colors.info.transparent,

      // note: this cannot have any transparency since default cells that
      // overlay/overflow on hover inherit this background and need to occlude cells below
      '--rdg-row-background-color': bgColor,
      '--rdg-row-hover-background-color': transparent
        ? theme.colors.background.primary
        : theme.colors.background.secondary,

      // TODO: magic 32px number is unfortunate. it would be better to have the content
      // flow using flexbox rather than hard-coding this size via a calc
      blockSize: enablePagination ? 'calc(100% - 32px)' : '100%',
      scrollbarWidth: 'thin',
      scrollbarColor: theme.isDark ? '#fff5 #fff1' : '#0005 #0001',

      border: 'none',

      '.rdg-cell': {
        padding: theme.spacing(0.75),

        '&:last-child': {
          borderInlineEnd: 'none',
        },
      },

      // add a box shadow on hover and selection for all body cells
      '& > :not(.rdg-summary-row, .rdg-header-row) > .rdg-cell': {
        '&:hover, &[aria-selected=true]': { boxShadow: theme.shadows.z2 },
        // selected cells should appear below hovered cells.
        '&:hover': { zIndex: theme.zIndex.tooltip - 7 },
        '&[aria-selected=true]': { zIndex: theme.zIndex.tooltip - 6 },
      },

      '.rdg-cell.rdg-cell-frozen': {
        backgroundColor: '--rdg-row-background-color',
        zIndex: theme.zIndex.tooltip - 4,
        '&:hover': { zIndex: theme.zIndex.tooltip - 2 },
        '&[aria-selected=true]': { zIndex: theme.zIndex.tooltip - 3 },
      },

      '.rdg-header-row, .rdg-summary-row': {
        '.rdg-cell': {
          zIndex: theme.zIndex.tooltip - 5,
          '&.rdg-cell-frozen': {
            zIndex: theme.zIndex.tooltip - 1,
          },
        },
      },

      '.rdg-summary-row >': {
        '.rdg-cell': {
          // 0.75 padding causes "jumping" on hover.
          paddingBlock: theme.spacing(0.625),
        },
        '&:hover, &[aria-selected=true]': {
          whiteSpace: 'pre-line',
          height: '100%',
          minHeight: 'fit-content',
          overflowY: 'visible',
          boxShadow: theme.shadows.z2,
        },
      },
    }),
    header: css({
      ...(hideHeader
        ? { display: 'none' }
        : {
            paddingBlockStart: 0,
            fontWeight: 'normal',
            '& .rdg-cell': { height: '100%', alignItems: 'flex-end' },
          }),
    }),
  };
};

const getPaginationStyles = (theme: GrafanaTheme2) => ({
  container: css({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    width: '100%',
  }),
  summary: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1, 0, 2),
  }),
});
