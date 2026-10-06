/** Version of the host <-> frame bridge. The frame bootstrap embeds the same value. */
export const RENDER_PROTOCOL_VERSION = 1;
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
export const MAX_VARIABLES = 100;
export const MAX_VARIABLE_VALUES = 1000;
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
/** Element count under #root after each draw. */
export const MAX_DOM_NODES = 20_000;
/** Extra links inside this window are dropped silently. */
export const LINK_MIN_INTERVAL_MS = 1_000;

/** Written by the dashboard datasource into frame.meta.custom. */
export const DASHBOARD_SOURCE_PANEL_ID_META_KEY = 'dashboardSourcePanelId';
export const DASHBOARD_SOURCE_PANEL_TITLE_META_KEY = 'dashboardSourcePanelTitle';
