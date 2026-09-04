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
  // Bounds on a JSON cell expanded by hover. Unlike a long string, a JSON blob can be hundreds of
  // lines and thousands of columns wide, so an unbounded expansion escapes the panel and puts the
  // content out of reach again. Capping the width lets `pre-wrap` wrap instead of growing, and the
  // height cap keeps the overlay scrollable in place; the inspector remains the full-value view.
  JSON_OVERFLOW_MAX_WIDTH: 600,
  JSON_OVERFLOW_MAX_HEIGHT: '40vh',
};

/**
 * Horizontal chrome around a cell's content: left + right padding plus the right border. Subtract
 * from a column's pixel width to get its usable content width, or add to size a column to content.
 */
export const CELL_HORIZONTAL_CHROME = TABLE.CELL_PADDING * 2 + TABLE.BORDER_RIGHT;

/**
 * Marker classes stamped onto the first and last columns once the final column list is assembled.
 * CSS can't find those columns on its own: `:first-child`/`:last-child` match the first and last
 * *rendered* cells, and react-data-grid drops off-screen columns from the DOM, so they stop being
 * the edge columns as soon as the grid scrolls horizontally.
 */
export const FIRST_COLUMN_CLASS = 'table-ng-first-col';
export const LAST_COLUMN_CLASS = 'table-ng-last-col';

// Distance from a panel's content edge to the start of its title text: PanelChrome's header
// container padding (theme.spacing(1)) plus the title's own inline-start padding (x0_5).
const PANEL_TITLE_INSET = 12;

/**
 * Extra inline-start padding the first column takes when the surrounding panel renders without
 * padding of its own (see the `noPanelPadding` prop). The table then sits flush against the panel
 * edge, which would leave the first column's content 6px in while the panel title sits at 12px —
 * this makes up the difference so the two line up.
 */
export const FIRST_COLUMN_EXTRA_PADDING = PANEL_TITLE_INSET - TABLE.CELL_PADDING;

/**
 * Vertical space the pagination controls take under the grid: the control row itself, plus the
 * margin above and below it.
 *
 * One constant because three places have to agree on it — `paginationContainer`'s own margin, the
 * grid's `blockSize` reservation, and `usePaginatedRows`, which subtracts it from the panel height
 * before working out how many rows fit on a page. Those were three separate numbers derived three
 * different ways, and they no longer added up: the grid reserved 38px against a chrome that
 * measures ~45px, so the grid plus the controls overflowed the panel.
 *
 * The row height is hand-measured rather than a token: it comes out of the `size="sm"` Pagination
 * buttons and their line-height (29.2px), rounded up to a whole spacing step.
 */
const PAGINATION_ROW_HEIGHT = 32;
export const PAGINATION_MARGIN = 8;
export const PAGINATION_CHROME_HEIGHT = PAGINATION_ROW_HEIGHT + PAGINATION_MARGIN * 2;

// Space a single header affordance icon (filter / sort / type) reserves next to the label. Sized to
// the widest of them — the sort arrow, rendered at Icon size "lg" (18px) — plus the flex gap, so a
// filterable or sorted column doesn't ellipsize its title once its icon appears.
const HEADER_ICON_WIDTH = 18;
const HEADER_ICON_GAP = 4;
export const HEADER_ICON_SPACE = HEADER_ICON_WIDTH + HEADER_ICON_GAP;

// Space one of the header's IconButtons reserves. They need their own measurement rather than
// reusing HEADER_ICON_SPACE: a size="sm" IconButton is a 14px glyph plus the 4px trailing margin the
// component sets on itself, where the icons above are bare `Icon`s. Keep in step with the `size`
// props at the call sites — changing one without this silently mis-sizes auto columns.
const HEADER_ICON_BUTTON_WIDTH = 14 + 4;
const HEADER_ICON_BUTTON_SPACE = HEADER_ICON_BUTTON_WIDTH + HEADER_ICON_GAP;

// The `table.refresh` column menu, which replaces the classic header's inline filter icon. It stays
// in flow while hover-hidden (it fades with opacity rather than unmounting), so this reserves the
// same space whether or not it happens to be visible.
export const HEADER_MENU_SPACE = HEADER_ICON_BUTTON_SPACE;

// The info button a column with `headerTooltip` set renders next to its label. Always in flow, and
// in both the classic and refreshed headers.
export const HEADER_TOOLTIP_SPACE = HEADER_ICON_BUTTON_SPACE;
