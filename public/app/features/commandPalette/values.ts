// Bumped to way higher value, to give it more weight when searching
export const RECENT_SCOPES_PRIORITY = 50;
export const SCOPES_PRIORITY = 8;
export const RECENT_DASHBOARDS_PRIORITY = 6;
export const ACTIONS_PRIORITY = 5;
export const DEFAULT_PRIORITY = 4;
export const PREFERENCES_PRIORITY = 3;
export const EXTENSIONS_PRIORITY = 2;
export const SEARCH_RESULTS_PRIORITY = 1; // Dynamic actions should be below static ones so the list doesn't 'jump' when they come in

// Stable, language-agnostic section identifiers set on actions via `sectionId`, used
// for analytics so the reported group doesn't depend on the translated section header.
export const SECTION_RECENT_SCOPES = 'recent-scopes';
export const SECTION_SCOPES = 'scopes';
export const SECTION_RECENT_DASHBOARDS = 'recent-dashboards';
export const SECTION_ACTIONS = 'actions';
export const SECTION_PAGES = 'pages';
export const SECTION_PREFERENCES = 'preferences';
export const SECTION_DASHBOARDS = 'dashboards';
export const SECTION_FOLDERS = 'folders';
export const SECTION_EXTENSIONS = 'extensions';
export const SECTION_DEEP_SEARCH = 'deep-search';
