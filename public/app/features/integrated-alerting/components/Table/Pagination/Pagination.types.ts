import { SelectableValue } from '@grafana/data';

export interface PaginationProps {
  totalItems: number;
  pageCount: number;
  initialPageIndex?: number;
  pagesPerView?: number;
  pageSizeOptions: Array<SelectableValue<number>>;
  pageSize: number;
  nrRowsOnCurrentPage: number;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (size: number) => void;
}
