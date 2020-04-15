// Constants that both app and workers need, since workers can import from
// the app but the app can't import from a worker.

// Symbols can't be used with web workers.
export const JSON_STREAM_DONE = 'JSON_STREAM_DONE';
