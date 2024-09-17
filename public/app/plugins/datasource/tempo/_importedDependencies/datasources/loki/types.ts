export interface QueryStats {
  streams: number;
  chunks: number;
  bytes: number;
  entries: number;
  // The error message displayed in the UI when we cant estimate the size of the query.
  message?: string;
}
