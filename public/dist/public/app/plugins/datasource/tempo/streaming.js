import { __awaiter } from "tslib";
import { capitalize } from 'lodash';
import { map, defer, mergeMap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { FieldType, LiveChannelScope, LoadingState, ThresholdsMode, } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { SearchStreamingState } from './dataquery.gen';
import { DEFAULT_SPSS } from './datasource';
import { formatTraceQLResponse } from './resultTransformer';
export function getLiveStreamKey() {
    return __awaiter(this, void 0, void 0, function* () {
        return uuidv4();
    });
}
export function doTempoChannelStream(query, ds, options, instanceSettings) {
    const range = options.range;
    let frames = undefined;
    let state = LoadingState.NotStarted;
    return defer(() => getLiveStreamKey()).pipe(mergeMap((key) => {
        var _a;
        const requestTime = performance.now();
        return getGrafanaLiveSrv()
            .getStream({
            scope: LiveChannelScope.DataSource,
            namespace: ds.uid,
            path: `search/${key}`,
            data: Object.assign(Object.assign({}, query), { SpansPerSpanSet: (_a = query.spss) !== null && _a !== void 0 ? _a : DEFAULT_SPSS, timeRange: {
                    from: range.from.toISOString(),
                    to: range.to.toISOString(),
                } }),
        })
            .pipe(map((evt) => {
            if ('message' in evt && (evt === null || evt === void 0 ? void 0 : evt.message)) {
                const currentTime = performance.now();
                const elapsedTime = currentTime - requestTime;
                // Schema should be [traces, metrics, state, error]
                const traces = evt.message.data.values[0][0];
                const metrics = evt.message.data.values[1][0];
                const frameState = evt.message.data.values[2][0];
                const error = evt.message.data.values[3][0];
                switch (frameState) {
                    case SearchStreamingState.Done:
                        state = LoadingState.Done;
                        break;
                    case SearchStreamingState.Streaming:
                        state = LoadingState.Streaming;
                        break;
                    case SearchStreamingState.Error:
                        throw new Error(error);
                }
                frames = [
                    metricsDataFrame(metrics, frameState, elapsedTime),
                    ...formatTraceQLResponse(traces, instanceSettings, query.tableType),
                ];
            }
            return {
                data: frames || [],
                state,
            };
        }));
    }));
}
function metricsDataFrame(metrics, state, elapsedTime) {
    const progressThresholds = {
        steps: [
            {
                color: 'blue',
                value: -Infinity,
            },
            {
                color: 'green',
                value: 75,
            },
        ],
        mode: ThresholdsMode.Absolute,
    };
    const frame = {
        refId: 'streaming-progress',
        name: 'Streaming Progress',
        length: 1,
        fields: [
            {
                name: 'state',
                type: FieldType.string,
                values: [capitalize(state.toString())],
                config: {
                    displayNameFromDS: 'State',
                },
            },
            {
                name: 'elapsedTime',
                type: FieldType.number,
                values: [elapsedTime],
                config: {
                    unit: 'ms',
                    displayNameFromDS: 'Elapsed Time',
                },
            },
            {
                name: 'totalBlocks',
                type: FieldType.number,
                values: [metrics.totalBlocks],
                config: {
                    displayNameFromDS: 'Total Blocks',
                },
            },
            {
                name: 'completedJobs',
                type: FieldType.number,
                values: [metrics.completedJobs],
                config: {
                    displayNameFromDS: 'Completed Jobs',
                },
            },
            {
                name: 'totalJobs',
                type: FieldType.number,
                values: [metrics.totalJobs],
                config: {
                    displayNameFromDS: 'Total Jobs',
                },
            },
            {
                name: 'progress',
                type: FieldType.number,
                values: [
                    state === SearchStreamingState.Done ? 100 : ((metrics.completedJobs || 0) / (metrics.totalJobs || 1)) * 100,
                ],
                config: {
                    displayNameFromDS: 'Progress',
                    unit: 'percent',
                    min: 0,
                    max: 100,
                    custom: {
                        cellOptions: {
                            type: 'gauge',
                            mode: 'gradient',
                        },
                    },
                    thresholds: progressThresholds,
                },
            },
        ],
        meta: {
            preferredVisualisationType: 'table',
        },
    };
    return frame;
}
//# sourceMappingURL=streaming.js.map