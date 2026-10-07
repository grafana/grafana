/** Version of the host <-> frame bridge. The frame bootstrap embeds the same value. */
export const RENDER_PROTOCOL_VERSION = 1;
/**
 * Version of the drawing API the code sees as panel.apiVersion. Within a version, changes are
 * additive only; a breaking change to ctx, the CSS variables or the links bumps it.
 */
export const DRAWING_API_VERSION = 1;
/** Class on the content document's <html> while the image renderer captures the dashboard. */
export const RENDER_TARGET_CLASS = 'gf-render-target';
/** The only window message the host posts to the frame; it carries the port and no data. */
export const RENDER_INIT_MESSAGE_TYPE = 'grafana-render:init';
/** Never add allow-same-origin, allow-popups, allow-forms or allow-top-navigation. */
export const RENDER_FRAME_SANDBOX = 'allow-scripts';

/** UTF-8 bytes of options.code. */
export const MAX_CODE_BYTES = 256 * 1024;
/** JSON.stringify(RenderInput) length, checked on the host before sending. */
export const MAX_TRANSFER_BYTES = 4 * 1024 * 1024;
/** Sum of field.values.length over all frames. */
export const MAX_TRANSFER_CELLS = 100_000;
export const MAX_TRANSFER_FRAMES = 1000;
/** Longer string cells are cut, with '…' appended. */
export const MAX_STRING_CELL_LENGTH = 1024;
export const MAX_DIAGNOSTIC_LENGTH = 4096;
export const MAX_HREF_LENGTH = 2048;
/** Frame -> host messages in a sliding one-second window. */
export const MAX_FRAME_MESSAGES_PER_SECOND = 50;

/** From the first iframe load until the frame reports 'ready'. */
export const STARTUP_TIMEOUT_MS = 15_000;
export const HEARTBEAT_MS = 1_000;
/** Only judged after the frame answered at least one ping. */
export const UNRESPONSIVE_MS = 8_000;
/** Per seq, until 'render-complete'. */
export const RENDER_TIMEOUT_MS = 10_000;
export const MAX_READINESS_HOLD_MS = 30_000;
export const MAX_HEIGHT_HINT_PX = 10_000;
/** How long the host waits for the frame to return a capture of its drawing. */
export const CAPTURE_TIMEOUT_MS = 3_000;
/** Length of the PNG data URL a capture may return. */
export const MAX_CAPTURE_LENGTH = 8 * 1024 * 1024;
/** Element count under #root after each draw. */
export const MAX_DOM_NODES = 20_000;
/** Elements the layout report looks at after a draw; past this it reports truncated. */
export const MAX_LAYOUT_ELEMENTS = 800;
/** Line boxes of text the layout report keeps for coverage and overlap checks. */
export const MAX_LAYOUT_TEXT_RECTS = 400;
/** Examples per finding in the layout report; the counts stay exact. */
export const MAX_LAYOUT_SAMPLES = 5;
export const MAX_LAYOUT_EMPTY_REGIONS = 3;
/** Length of an element label or text excerpt in the layout report. */
export const MAX_LAYOUT_LABEL_LENGTH = 120;
/** Upper bound on the columns and rows of the grid that measures coverage. */
export const LAYOUT_GRID_CELLS = 48;
/** Extra links inside this window are dropped silently. */
export const LINK_MIN_INTERVAL_MS = 1_000;

/** Written by the dashboard datasource into frame.meta.custom. */
export const DASHBOARD_SOURCE_PANEL_ID_META_KEY = 'dashboardSourcePanelId';
export const DASHBOARD_SOURCE_PANEL_TITLE_META_KEY = 'dashboardSourcePanelTitle';
export const DASHBOARD_SOURCE_REF_ID_META_KEY = 'dashboardSourceRefId';
