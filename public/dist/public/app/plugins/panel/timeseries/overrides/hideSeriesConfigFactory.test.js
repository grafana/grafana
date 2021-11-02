import { ByNamesMatcherMode, FieldMatcherID, FieldType, toDataFrame, } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { hideSeriesConfigFactory } from './hideSeriesConfigFactory';
describe('hideSeriesConfigFactory', function () {
    it('should create config override matching one series', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.ToggleSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['temperature'])],
        });
    });
    it('should create config override matching one series if selected with others', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.ToggleSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature', 'humidity'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['temperature'])],
        });
    });
    it('should create config override that append series to existing override', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.AppendToSelection,
            fieldIndex: {
                frameIndex: 1,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['temperature', 'humidity'])],
        });
    });
    it('should create config override that hides all series if appending only existing series', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.AppendToSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride([])],
        });
    });
    it('should create config override that removes series if appending existing field', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.AppendToSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature', 'humidity'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['humidity'])],
        });
    });
    it('should create config override replacing existing series', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.ToggleSelection,
            fieldIndex: {
                frameIndex: 1,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['humidity'])],
        });
    });
    it('should create config override removing existing series', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.ToggleSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [],
        });
    });
    it('should remove override if all fields are appended', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.AppendToSelection,
            fieldIndex: {
                frameIndex: 1,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [],
        });
    });
    it('should create config override hiding appended series if no previous override exists', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.AppendToSelection,
            fieldIndex: {
                frameIndex: 0,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'pressure', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['humidity', 'pressure'])],
        });
    });
    it('should return existing override if invalid index is passed', function () {
        var event = {
            mode: SeriesVisibilityChangeMode.ToggleSelection,
            fieldIndex: {
                frameIndex: 4,
                fieldIndex: 1,
            },
        };
        var existingConfig = {
            defaults: {},
            overrides: [createOverride(['temperature'])],
        };
        var data = [
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
            toDataFrame({
                fields: [
                    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
                    { name: 'humidity', type: FieldType.number, values: [1, 3, 5, 7] },
                ],
            }),
        ];
        var config = hideSeriesConfigFactory(event, existingConfig, data);
        expect(config).toEqual({
            defaults: {},
            overrides: [createOverride(['temperature'])],
        });
    });
});
var createOverride = function (matchers) {
    return {
        __systemRef: 'hideSeriesFrom',
        matcher: {
            id: FieldMatcherID.byNames,
            options: {
                mode: ByNamesMatcherMode.exclude,
                names: matchers,
                prefix: 'All except:',
                readOnly: true,
            },
        },
        properties: [
            {
                id: 'custom.hideFrom',
                value: {
                    graph: true,
                    legend: false,
                    tooltip: false,
                },
            },
        ],
    };
};
//# sourceMappingURL=hideSeriesConfigFactory.test.js.map