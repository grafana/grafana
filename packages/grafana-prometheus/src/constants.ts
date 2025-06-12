// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

export const PROM_CONFIG_LABEL_WIDTH = 30;

// single duration input
export const DURATION_REGEX = /^$|^\d+(ms|[Mwdhmsy])$/;

// multiple duration input
export const MULTIPLE_DURATION_REGEX = /(\d+)(.+)/;

export const NON_NEGATIVE_INTEGER_REGEX = /^(0|[1-9]\d*)(\.\d+)?(e\+?\d+)?$/; // non-negative integers, including scientific notation

export const durationError = 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s';
export const countError = 'Value is not valid, you can use non-negative integers, including scientific notation';
