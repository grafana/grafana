import { getScrollbarWidth } from '../../../utils/scrollbar';

/** Column width and sizing configuration */
export const COLUMN = {
  DEFAULT_WIDTH: 150,
  EXPANDER_WIDTH: 50,
  // This will need to eventually change to 36
  MIN_WIDTH: 150,
};

/** Table layout and display constants */
export const TABLE = {
  CELL_PADDING: 8,
  MAX_CELL_HEIGHT: 48,
  PAGINATION_LIMIT: 750,
  SCROLL_BAR_WIDTH: getScrollbarWidth(),
};
