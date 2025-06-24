// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

export const PROM_CONFIG_LABEL_WIDTH = 30;

export const LIST_ITEM_SIZE = 25;
export const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';

// single duration input
export const DURATION_REGEX = /^$|^\d+(ms|[Mwdhmsy])$/;

// multiple duration input
export const MULTIPLE_DURATION_REGEX = /(\d+)(.+)/;

export const NON_NEGATIVE_INTEGER_REGEX = /^(0|[1-9]\d*)(\.\d+)?(e\+?\d+)?$/; // non-negative integers, including scientific notation

export const EMPTY_SELECTOR = '{}';
export const DEFAULT_SERIES_LIMIT = 40000;
export const MATCH_ALL_LABELS_STR = '__name__!=""';
export const MATCH_ALL_LABELS = '{__name__!=""}';
export const METRIC_LABEL = '__name__';

/**
 * @deprecated
 */
export const REMOVE_SERIES_LIMIT = 'none';

export const durationError = 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s';
export const countError = 'Value is not valid, you can use non-negative integers, including scientific notation';
export const seriesLimitError =
  'Value is not valid, you can use only numbers or leave it empty to use default limit or set 0 to have no limit.';
