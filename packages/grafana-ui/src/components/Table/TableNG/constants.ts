import { getScrollbarWidth } from '../../../utils/scrollbar';

/** Column width and sizing configuration */
export const COLUMN = {
  DEFAULT_WIDTH: 150,
  EXPANDER_WIDTH: 50,
  MIN_WIDTH: 36,
};

/** Table layout and display constants */
export const TABLE = {
  CELL_PADDING: 6,
  MAX_CELL_HEIGHT: 48,
  PAGINATION_LIMIT: 750,
  SCROLL_BAR_WIDTH: getScrollbarWidth(),
};
