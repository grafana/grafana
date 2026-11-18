export type ViewMode = 'write' | 'split' | 'preview';

// Kept out of TextNGEditor so reading the default does not pull its lazy chunk into the eager bundle.
export const DEFAULT_VIEW_MODE: ViewMode = 'split';
