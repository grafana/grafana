/** Column width and sizing configuration */
export const COLUMN = {
  DEFAULT_WIDTH: 150,
  EXPANDER_WIDTH: 50,
  // This will need to eventually change to 36
  MIN_WIDTH: 50,
  // Upper bound for a content-aware auto-sized column before we grow it to fill the panel.
  // Keeps one long value (e.g. a JSON blob) from consuming the whole table width.
  MAX_AUTO_WIDTH: 400,
  // Content-aware width for image columns. Images scale to the cell (object-fit: contain), so a
  // wide column is mostly whitespace — a small default reads better than the graphical default.
  IMAGE_WIDTH: 72,
};

/** Table layout and display constants */
export const TABLE = {
  CELL_PADDING: 6,
  LINE_HEIGHT: 22,
  MAX_CELL_HEIGHT: 48,
  PAGINATION_LIMIT: 750,
  SCROLL_BAR_WIDTH: 8,
  SCROLL_BAR_MARGIN: 2,
  HEADER_HEIGHT: 34,
  NESTED_NO_DATA_HEIGHT: 60,
  BORDER_RIGHT: 1,
  SCROLLBAR_AFFORDANCE: 16,
};

/**
 * Horizontal chrome around a cell's content: left + right padding plus the right border. Subtract
 * from a column's pixel width to get its usable content width, or add to size a column to content.
 */
export const CELL_HORIZONTAL_CHROME = TABLE.CELL_PADDING * 2 + TABLE.BORDER_RIGHT;

/** Space a single header affordance icon (filter / sort / type) reserves next to the label. */
export const HEADER_ICON_WIDTH = 16;
export const HEADER_ICON_GAP = 4;
export const HEADER_ICON_SPACE = HEADER_ICON_WIDTH + HEADER_ICON_GAP;
