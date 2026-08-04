/** Column width and sizing configuration */
export const COLUMN = {
  DEFAULT_WIDTH: 150,
  EXPANDER_WIDTH: 50,
  // This will need to eventually change to 36
  MIN_WIDTH: 50,
  // Upper bound for a content-aware auto-sized column before we grow it to fill the panel.
  // Keeps one long value (e.g. a JSON blob) from consuming the whole table width.
  MAX_AUTO_WIDTH: 400,
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
