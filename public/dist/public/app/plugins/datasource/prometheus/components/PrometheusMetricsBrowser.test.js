import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTheme } from '@grafana/ui';
import { buildSelector, facetLabels, UnthemedPrometheusMetricsBrowser, } from './PrometheusMetricsBrowser';
describe('buildSelector()', function () {
    it('returns an empty selector for no labels', function () {
        expect(buildSelector([])).toEqual('{}');
    });
    it('returns an empty selector for selected labels with no values', function () {
        var labels = [{ name: 'foo', selected: true }];
        expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns an empty selector for one selected label with no selected values', function () {
        var labels = [{ name: 'foo', selected: true, values: [{ name: 'bar' }] }];
        expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns a simple selector from a selected label with a selected value', function () {
        var labels = [{ name: 'foo', selected: true, values: [{ name: 'bar', selected: true }] }];
        expect(buildSelector(labels)).toEqual('{foo="bar"}');
    });
    it('metric selector without labels', function () {
        var labels = [{ name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] }];
        expect(buildSelector(labels)).toEqual('foo{}');
    });
    it('selector with multiple metrics', function () {
        var labels = [
            {
                name: '__name__',
                selected: true,
                values: [
                    { name: 'foo', selected: true },
                    { name: 'bar', selected: true },
                ],
            },
        ];
        expect(buildSelector(labels)).toEqual('{__name__=~"foo|bar"}');
    });
    it('metric selector with labels', function () {
        var labels = [
            { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
            { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('foo{bar="baz"}');
    });
});
describe('facetLabels()', function () {
    var possibleLabels = {
        cluster: ['dev'],
        namespace: ['alertmanager'],
    };
    var labels = [
        { name: 'foo', selected: true, values: [{ name: 'bar' }] },
        { name: 'cluster', values: [{ name: 'dev' }, { name: 'ops' }, { name: 'prod' }] },
        { name: 'namespace', values: [{ name: 'alertmanager' }] },
    ];
    it('returns no labels given an empty label set', function () {
        expect(facetLabels([], {})).toEqual([]);
    });
    it('marks all labels as hidden when no labels are possible', function () {
        var result = facetLabels(labels, {});
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[0].values).toBeUndefined();
    });
    it('keeps values as facetted when they are possible', function () {
        var result = facetLabels(labels, possibleLabels);
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[0].values).toBeUndefined();
        expect(result[1].hidden).toBeFalsy();
        expect(result[1].values.length).toBe(1);
        expect(result[1].values[0].name).toBe('dev');
    });
    it('does not facet out label values that are currently being facetted', function () {
        var result = facetLabels(labels, possibleLabels, 'cluster');
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[1].hidden).toBeFalsy();
        // 'cluster' is being facetted, should show all 3 options even though only 1 is possible
        expect(result[1].values.length).toBe(3);
        expect(result[2].values.length).toBe(1);
    });
});
describe('PrometheusMetricsBrowser', function () {
    var setupProps = function () {
        var mockLanguageProvider = {
            start: function () { return Promise.resolve(); },
            getLabelValues: function (name) {
                switch (name) {
                    case 'label1':
                        return ['value1-1', 'value1-2'];
                    case 'label2':
                        return ['value2-1', 'value2-2'];
                    case 'label3':
                        return ['value3-1', 'value3-2'];
                }
                return [];
            },
            fetchSeriesLabels: function (selector) {
                switch (selector) {
                    case '{label1="value1-1"}':
                        return { label1: ['value1-1'], label2: ['value2-1'], label3: ['value3-1'] };
                    case '{label1=~"value1-1|value1-2"}':
                        return { label1: ['value1-1', 'value1-2'], label2: ['value2-1'], label3: ['value3-1', 'value3-2'] };
                }
                // Allow full set by default
                return {
                    label1: ['value1-1', 'value1-2'],
                    label2: ['value2-1', 'value2-2'],
                };
            },
            getLabelKeys: function () { return ['label1', 'label2', 'label3']; },
        };
        var defaults = {
            theme: getTheme(),
            onChange: function () { },
            autoSelect: 0,
            languageProvider: mockLanguageProvider,
            lastUsedLabels: [],
            storeLastUsedLabels: function () { },
            deleteLastUsedLabels: function () { },
        };
        return defaults;
    };
    // Clear label selection manually because it's saved in localStorage
    afterEach(function () {
        var clearBtn = screen.getByLabelText('Selector clear button');
        userEvent.click(clearBtn);
    });
    it('renders and loader shows when empty, and then first set of labels', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    // Loading appears and dissappears
                    screen.getByText(/Loading labels/);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.queryByText(/Loading labels/)).not.toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    // Initial set of labels is available and not selected
                    expect(screen.queryByRole('option', { name: 'label1' })).toBeInTheDocument();
                    expect(screen.queryByRole('option', { name: 'label1', selected: true })).not.toBeInTheDocument();
                    expect(screen.queryByRole('option', { name: 'label2' })).toBeInTheDocument();
                    expect(screen.queryByRole('option', { name: 'label2', selected: true })).not.toBeInTheDocument();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
                    return [2 /*return*/];
            }
        });
    }); });
    it('allows label and value selection/deselection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props, label2, _a, label1, _b, value, value2, selectedValue;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 1:
                    label2 = _c.sent();
                    expect(screen.queryByRole('list', { name: /Values/ })).not.toBeInTheDocument();
                    userEvent.click(label2);
                    expect(screen.queryByRole('option', { name: /label2/, selected: true })).toBeInTheDocument();
                    // List of values for label2 appears
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('list')];
                case 2:
                    // List of values for label2 appears
                    _a.apply(void 0, [_c.sent()]).toHaveLength(1);
                    expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
                    expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
                    expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 3:
                    label1 = _c.sent();
                    userEvent.click(label1);
                    expect(screen.queryByRole('option', { name: /label1/, selected: true })).toBeInTheDocument();
                    return [4 /*yield*/, screen.findByLabelText('Values for label1')];
                case 4:
                    _c.sent();
                    _b = expect;
                    return [4 /*yield*/, screen.findAllByRole('list', { name: /Values/ })];
                case 5:
                    _b.apply(void 0, [_c.sent()]).toHaveLength(2);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-2', selected: false })];
                case 6:
                    value = _c.sent();
                    userEvent.click(value);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-2', selected: true })];
                case 7:
                    _c.sent();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-2"}');
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-1', selected: false })];
                case 8:
                    value2 = _c.sent();
                    userEvent.click(value2);
                    // await screen.findByRole('option', {name: 'value2-1', selected: true});
                    return [4 /*yield*/, screen.findByText('{label2=~"value2-1|value2-2"}')];
                case 9:
                    // await screen.findByRole('option', {name: 'value2-1', selected: true});
                    _c.sent();
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-2', selected: true })];
                case 10:
                    selectedValue = _c.sent();
                    userEvent.click(selectedValue);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-1', selected: true })];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-2', selected: false })];
                case 12:
                    _c.sent();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
                    return [2 /*return*/];
            }
        });
    }); });
    it('allows label selection from multiple labels', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props, label2, _a, label1, _b, value2, value1, selectedLabel, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 1:
                    label2 = _d.sent();
                    userEvent.click(label2);
                    // List of values for label2 appears
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('list')];
                case 2:
                    // List of values for label2 appears
                    _a.apply(void 0, [_d.sent()]).toHaveLength(1);
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 3:
                    label1 = _d.sent();
                    userEvent.click(label1);
                    return [4 /*yield*/, screen.findByLabelText('Values for label1')];
                case 4:
                    _d.sent();
                    _b = expect;
                    return [4 /*yield*/, screen.findAllByRole('list', { name: /Values/ })];
                case 5:
                    _b.apply(void 0, [_d.sent()]).toHaveLength(2);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-1', selected: false })];
                case 6:
                    value2 = _d.sent();
                    userEvent.click(value2);
                    return [4 /*yield*/, screen.findByText('{label2="value2-1"}')];
                case 7:
                    _d.sent();
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value1-2', selected: false })];
                case 8:
                    value1 = _d.sent();
                    userEvent.click(value1);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value1-2', selected: true })];
                case 9:
                    _d.sent();
                    return [4 /*yield*/, screen.findByText('{label1="value1-2",label2="value2-1"}')];
                case 10:
                    _d.sent();
                    return [4 /*yield*/, screen.findAllByRole('option', { name: /label1/, selected: true })];
                case 11:
                    selectedLabel = (_d.sent())[0];
                    userEvent.click(selectedLabel);
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 12:
                    _d.sent();
                    _c = expect;
                    return [4 /*yield*/, screen.findAllByRole('list', { name: /Values/ })];
                case 13:
                    _c.apply(void 0, [_d.sent()]).toHaveLength(1);
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
                    return [2 /*return*/];
            }
        });
    }); });
    it('allows clearing the label selection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props, label2, _a, label1, _b, value2, clearBtn;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 1:
                    label2 = _c.sent();
                    userEvent.click(label2);
                    // List of values for label2 appears
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('list')];
                case 2:
                    // List of values for label2 appears
                    _a.apply(void 0, [_c.sent()]).toHaveLength(1);
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 3:
                    label1 = _c.sent();
                    userEvent.click(label1);
                    return [4 /*yield*/, screen.findByLabelText('Values for label1')];
                case 4:
                    _c.sent();
                    _b = expect;
                    return [4 /*yield*/, screen.findAllByRole('list', { name: /Values/ })];
                case 5:
                    _b.apply(void 0, [_c.sent()]).toHaveLength(2);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value2-1', selected: false })];
                case 6:
                    value2 = _c.sent();
                    userEvent.click(value2);
                    return [4 /*yield*/, screen.findByText('{label2="value2-1"}')];
                case 7:
                    _c.sent();
                    clearBtn = screen.getByLabelText('Selector clear button');
                    userEvent.click(clearBtn);
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 8:
                    _c.sent();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
                    return [2 /*return*/];
            }
        });
    }); });
    it('filters values by input text', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props, label2, label1, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 1:
                    label2 = _c.sent();
                    userEvent.click(label2);
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 2:
                    label1 = _c.sent();
                    userEvent.click(label1);
                    return [4 /*yield*/, screen.findByLabelText('Values for label1')];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, screen.findByLabelText('Values for label2')];
                case 4:
                    _c.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('option', { name: /value/ })];
                case 5:
                    _a.apply(void 0, [_c.sent()]).toHaveLength(4);
                    // Typing '1' to filter for values
                    userEvent.type(screen.getByLabelText('Filter expression for label values'), '1');
                    expect(screen.getByLabelText('Filter expression for label values')).toHaveValue('1');
                    _b = expect;
                    return [4 /*yield*/, screen.findAllByRole('option', { name: /value/ })];
                case 6:
                    _b.apply(void 0, [_c.sent()]).toHaveLength(3);
                    expect(screen.queryByRole('option', { name: 'value2-2' })).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('facets labels', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props, label2, label1, _a, value1, value12;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    props = setupProps();
                    render(React.createElement(UnthemedPrometheusMetricsBrowser, __assign({}, props)));
                    return [4 /*yield*/, screen.findByRole('option', { name: /label2/, selected: false })];
                case 1:
                    label2 = _b.sent();
                    userEvent.click(label2);
                    return [4 /*yield*/, screen.findByRole('option', { name: /label1/, selected: false })];
                case 2:
                    label1 = _b.sent();
                    userEvent.click(label1);
                    return [4 /*yield*/, screen.findByLabelText('Values for label1')];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, screen.findByLabelText('Values for label2')];
                case 4:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('option', { name: /value/ })];
                case 5:
                    _a.apply(void 0, [_b.sent()]).toHaveLength(4);
                    expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3');
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value1-1', selected: false })];
                case 6:
                    value1 = _b.sent();
                    userEvent.click(value1);
                    return [4 /*yield*/, waitForElementToBeRemoved(screen.queryByRole('option', { name: 'value2-2' }))];
                case 7:
                    _b.sent();
                    expect(screen.queryByRole('option', { name: 'value1-2' })).toBeInTheDocument();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1="value1-1"}');
                    expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3 (1)');
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value1-2', selected: false })];
                case 8:
                    value12 = _b.sent();
                    userEvent.click(value12);
                    return [4 /*yield*/, screen.findByRole('option', { name: 'value1-2', selected: true })];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, screen.findByRole('option', { name: /label3/, selected: false })];
                case 10:
                    _b.sent();
                    userEvent.click(screen.getByRole('option', { name: /label3/ }));
                    return [4 /*yield*/, screen.findByLabelText('Values for label3')];
                case 11:
                    _b.sent();
                    expect(screen.queryByRole('option', { name: 'value1-1', selected: true })).toBeInTheDocument();
                    expect(screen.queryByRole('option', { name: 'value1-2', selected: true })).toBeInTheDocument();
                    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1=~"value1-1|value1-2"}');
                    expect(screen.queryAllByRole('option', { name: /label3/ })[0]).toHaveTextContent('label3 (2)');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=PrometheusMetricsBrowser.test.js.map