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

// Space a single header affordance icon (filter / sort / type) reserves next to the label. Sized to
// the widest of them — the sort arrow, rendered at Icon size "lg" (18px) — plus the flex gap, so a
// filterable or sorted column doesn't ellipsize its title once its icon appears.
const HEADER_ICON_WIDTH = 18;
const HEADER_ICON_GAP = 4;
export const HEADER_ICON_SPACE = HEADER_ICON_WIDTH + HEADER_ICON_GAP;

// Space the `table.refresh` header column menu reserves. It replaces the inline filter icon, but is
// an IconButton rather than a bare Icon, so it needs its own measurement: a size="sm" IconButton is
// a 14px glyph plus the 4px trailing margin the component sets on itself. Keep in step with the
// `size` prop in HeaderCellMenu — changing one without the other silently mis-sizes auto columns.
// The menu button stays in flow while hover-hidden (it fades with opacity rather than unmounting),
// so this reserves the same space whether or not it happens to be visible.
const HEADER_MENU_BUTTON_WIDTH = 14 + 4;
export const HEADER_MENU_SPACE = HEADER_MENU_BUTTON_WIDTH + HEADER_ICON_GAP;
