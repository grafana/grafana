import { FieldColorModeId, FieldMatcherID } from '@grafana/data';
import { changeSeriesColorConfigFactory } from './colorSeriesConfigFactory';
describe('changeSeriesColorConfigFactory', function () {
    it('should create config override to change color for serie', function () {
        var label = 'temperature';
        var color = 'green';
        var existingConfig = {
            defaults: {},
            overrides: [],
        };
        var config = changeSeriesColorConfigFactory(label, color, existingConfig);
        expect(config).toEqual({
            defaults: {},
            overrides: [
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: label,
                    },
                    properties: [
                        {
                            id: 'color',
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                },
            ],
        });
    });
    it('should create config override to change color for serie when override already exists for series', function () {
        var label = 'temperature';
        var color = 'green';
        var existingConfig = {
            defaults: {},
            overrides: [
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: label,
                    },
                    properties: [
                        {
                            id: 'other',
                            value: 'other',
                        },
                    ],
                },
            ],
        };
        var config = changeSeriesColorConfigFactory(label, color, existingConfig);
        expect(config).toEqual({
            defaults: {},
            overrides: [
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: label,
                    },
                    properties: [
                        {
                            id: 'other',
                            value: 'other',
                        },
                        {
                            id: 'color',
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                },
            ],
        });
    });
    it('should create config override to change color for serie when override exists for other series', function () {
        var label = 'temperature';
        var color = 'green';
        var existingConfig = {
            defaults: {},
            overrides: [
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: 'humidity',
                    },
                    properties: [
                        {
                            id: 'color',
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                },
            ],
        };
        var config = changeSeriesColorConfigFactory(label, color, existingConfig);
        expect(config).toEqual({
            defaults: {},
            overrides: [
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: 'humidity',
                    },
                    properties: [
                        {
                            id: 'color',
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                },
                {
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: label,
                    },
                    properties: [
                        {
                            id: 'color',
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                },
            ],
        });
    });
});
//# sourceMappingURL=colorSeriesConfigFactory.test.js.map