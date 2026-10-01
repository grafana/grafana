// Prefix for the `aggregation.*` tags that the span pruning processor writes onto
// summary and preserved-outlier spans. Kept in its own lightweight module so both the
// trace transform (model) and UI utilities can share it without pulling in heavy
// dependencies across layers.
export const AGGREGATION_PREFIX = 'aggregation.';
