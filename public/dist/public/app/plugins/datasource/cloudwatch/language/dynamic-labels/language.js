import { config } from '@grafana/runtime';
// Dynamic labels: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/graph-dynamic-labels.html
export const DYNAMIC_LABEL_PATTERNS = [
    '${DATAPOINT_COUNT}',
    '${FIRST}',
    '${FIRST_LAST_RANGE}',
    '${FIRST_LAST_TIME_RANGE}',
    '${FIRST_TIME}',
    '${FIRST_TIME_RELATIVE}',
    '${LABEL}',
    '${LAST}',
    '${LAST_TIME}',
    '${LAST_TIME_RELATIVE}',
    '${MAX}',
    '${MAX_TIME}',
    '${MAX_TIME_RELATIVE}',
    '${MIN}',
    '${MIN_MAX_RANGE}',
    '${MIN_MAX_TIME_RANGE}',
    '${MIN_TIME}',
    '${MIN_TIME_RELATIVE}',
    "${PROP('AccountId')}",
    "${PROP('MetricName')}",
    "${PROP('Namespace')}",
    "${PROP('Period')}",
    "${PROP('Region')}",
    "${PROP('Stat')}",
    '${SUM}',
    ...(config.featureToggles.cloudWatchCrossAccountQuerying ? ["${PROP('AccountLabel')}"] : []),
];
export const language = {
    id: 'dynamicLabels',
    ignoreCase: false,
    tokenizer: {
        root: [
            { include: '@whitespace' },
            { include: '@builtInFunctions' },
            { include: '@string' },
            [/\$\{PROP\('Dim.[a-zA-Z0-9-_]?.*'\)\}+/, 'predefined'], //custom handling for dimension patterns
        ],
        builtInFunctions: [[DYNAMIC_LABEL_PATTERNS.map(escapeRegExp).join('|'), 'predefined']],
        whitespace: [[/\s+/, 'white']],
        string: [],
    },
};
export const conf = {};
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
//# sourceMappingURL=language.js.map