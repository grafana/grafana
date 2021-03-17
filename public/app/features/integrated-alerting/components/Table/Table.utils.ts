import { PAGE_SIZES } from './Pagination';

export const getProperPageSize = (pageSize: number) =>
  PAGE_SIZES.find(p => p.value === pageSize) ? pageSize : PAGE_SIZES[0].value;
