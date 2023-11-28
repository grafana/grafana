import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createTheme } from '@grafana/data';
import { buildSelector, facetLabels, UnthemedLokiLabelBrowser, } from './LokiLabelBrowser';
// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: () => null })));
describe('buildSelector()', () => {
    it('returns an empty selector for no labels', () => {
        expect(buildSelector([])).toEqual('{}');
    });
    it('returns an empty selector for selected labels with no values', () => {
        const labels = [{ name: 'foo', selected: true }];
        expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns an empty selector for one selected label with no selected values', () => {
        const labels = [{ name: 'foo', selected: true, values: [{ name: 'bar' }] }];
        expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns a simple selector from a selected label with a selected value', () => {
        const labels = [{ name: 'foo', selected: true, values: [{ name: 'bar', selected: true }] }];
        expect(buildSelector(labels)).toEqual('{foo="bar"}');
    });
});
describe('facetLabels()', () => {
    const possibleLabels = {
        cluster: ['dev'],
        namespace: ['alertmanager'],
    };
    const labels = [
        { name: 'foo', selected: true, values: [{ name: 'bar' }] },
        { name: 'cluster', values: [{ name: 'dev' }, { name: 'ops' }, { name: 'prod' }] },
        { name: 'namespace', values: [{ name: 'alertmanager' }] },
    ];
    it('returns no labels given an empty label set', () => {
        expect(facetLabels([], {})).toEqual([]);
    });
    it('marks all labels as hidden when no labels are possible', () => {
        const result = facetLabels(labels, {});
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[0].values).toBeUndefined();
    });
    it('keeps values as facetted when they are possible', () => {
        const result = facetLabels(labels, possibleLabels);
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[0].values).toBeUndefined();
        expect(result[1].hidden).toBeFalsy();
        expect(result[1].values.length).toBe(1);
        expect(result[1].values[0].name).toBe('dev');
    });
    it('does not facet out label values that are currently being facetted', () => {
        const result = facetLabels(labels, possibleLabels, 'cluster');
        expect(result.length).toEqual(labels.length);
        expect(result[0].hidden).toBeTruthy();
        expect(result[1].hidden).toBeFalsy();
        // 'cluster' is being facetted, should show all 3 options even though only 1 is possible
        expect(result[1].values.length).toBe(3);
        expect(result[2].values.length).toBe(1);
    });
});
describe('LokiLabelBrowser', () => {
    const setupProps = () => {
        const mockLanguageProvider = {
            start: () => Promise.resolve(),
            getLabelValues: (name) => {
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
            fetchSeriesLabels: (selector) => {
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
            getLabelKeys: () => ['label1', 'label2', 'label3'],
        };
        const defaults = {
            theme: createTheme(),
            onChange: () => { },
            autoSelect: 0,
            languageProvider: mockLanguageProvider,
            lastUsedLabels: [],
            storeLastUsedLabels: () => { },
            deleteLastUsedLabels: () => { },
        };
        return defaults;
    };
    // Clear label selection manually because it's saved in localStorage
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        const clearBtn = screen.getByLabelText('Selector clear button');
        yield userEvent.click(clearBtn);
    }));
    it('renders and loader shows when empty, and then first set of labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Loading appears and dissappears
        screen.getByText(/Loading labels/);
        yield waitFor(() => {
            expect(screen.queryByText(/Loading labels/)).not.toBeInTheDocument();
        });
        // Initial set of labels is available and not selected
        expect(screen.queryByRole('option', { name: 'label1' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'label1', selected: true })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'label2' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'label2', selected: true })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
    }));
    it('allows label and value selection/deselection', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Selecting label2
        const label2 = yield screen.findByRole('option', { name: 'label2', selected: false });
        expect(screen.queryByRole('list', { name: /Values/ })).not.toBeInTheDocument();
        yield userEvent.click(label2);
        expect(screen.queryByRole('option', { name: 'label2', selected: true })).toBeInTheDocument();
        // List of values for label2 appears
        expect(yield screen.findAllByRole('list')).toHaveLength(1);
        expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
        expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
        // Selecting label1, list for its values appears
        const label1 = yield screen.findByRole('option', { name: 'label1', selected: false });
        yield userEvent.click(label1);
        expect(screen.queryByRole('option', { name: 'label1', selected: true })).toBeInTheDocument();
        yield screen.findByLabelText('Values for label1');
        expect(yield screen.findAllByRole('list')).toHaveLength(2);
        // Selecting value2-2 of label2
        const value = yield screen.findByRole('option', { name: 'value2-2', selected: false });
        yield userEvent.click(value);
        yield screen.findByRole('option', { name: 'value2-2', selected: true });
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-2"}');
        // Selecting value2-1 of label2, both values now selected
        const value2 = yield screen.findByRole('option', { name: 'value2-1', selected: false });
        yield userEvent.click(value2);
        // await screen.findByRole('option', {name: 'value2-1', selected: true});
        yield screen.findByText('{label2=~"value2-1|value2-2"}');
        // Deselecting value2-2, one value should remain
        const selectedValue = yield screen.findByRole('option', { name: 'value2-2', selected: true });
        yield userEvent.click(selectedValue);
        yield screen.findByRole('option', { name: 'value2-1', selected: true });
        yield screen.findByRole('option', { name: 'value2-2', selected: false });
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
    }));
    it('allows label selection from multiple labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Selecting label2
        const label2 = yield screen.findByRole('option', { name: /label2/, selected: false });
        yield userEvent.click(label2);
        // List of values for label2 appears
        expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
        expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
        // Selecting label1, list for its values appears
        const label1 = yield screen.findByRole('option', { name: 'label1', selected: false });
        yield userEvent.click(label1);
        yield screen.findByLabelText('Values for label1');
        expect(yield screen.findAllByRole('list')).toHaveLength(2);
        // Selecting value2-1 of label2
        const value2 = yield screen.findByRole('option', { name: 'value2-1', selected: false });
        yield userEvent.click(value2);
        yield screen.findByText('{label2="value2-1"}');
        // Selecting value from label1 for combined selector
        const value1 = yield screen.findByRole('option', { name: 'value1-2', selected: false });
        yield userEvent.click(value1);
        yield screen.findByRole('option', { name: 'value1-2', selected: true });
        yield screen.findByText('{label1="value1-2",label2="value2-1"}');
        // Deselect label1 should remove label and value
        const selectedLabel = (yield screen.findAllByRole('option', { name: /label1/, selected: true }))[0];
        yield userEvent.click(selectedLabel);
        yield screen.findByRole('option', { name: /label1/, selected: false });
        expect(yield screen.findAllByRole('list')).toHaveLength(1);
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
    }));
    it('allows clearing the label selection', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Selecting label2
        const label2 = yield screen.findByRole('option', { name: 'label2', selected: false });
        yield userEvent.click(label2);
        // List of values for label2 appears
        expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
        expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
        // Selecting label1, list for its values appears
        const label1 = yield screen.findByRole('option', { name: 'label1', selected: false });
        yield userEvent.click(label1);
        yield screen.findByLabelText('Values for label1');
        expect(yield screen.findAllByRole('list')).toHaveLength(2);
        // Selecting value2-1 of label2
        const value2 = yield screen.findByRole('option', { name: 'value2-1', selected: false });
        yield userEvent.click(value2);
        yield screen.findByText('{label2="value2-1"}');
        // Clear selector
        const clearBtn = screen.getByLabelText('Selector clear button');
        yield userEvent.click(clearBtn);
        yield screen.findByRole('option', { name: 'label2', selected: false });
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
    }));
    it('filters values by input text', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Selecting label2 and label1
        const label2 = yield screen.findByRole('option', { name: /label2/, selected: false });
        yield userEvent.click(label2);
        const label1 = yield screen.findByRole('option', { name: /label1/, selected: false });
        yield userEvent.click(label1);
        yield screen.findByLabelText('Values for label1');
        yield screen.findByLabelText('Values for label2');
        expect(yield screen.findAllByRole('option', { name: /value/ })).toHaveLength(4);
        // Typing '1' to filter for values
        yield userEvent.type(screen.getByLabelText('Filter expression for values'), 'val1');
        expect(screen.getByLabelText('Filter expression for values')).toHaveValue('val1');
        expect(screen.queryByRole('option', { name: 'value2-2' })).not.toBeInTheDocument();
        expect(yield screen.findAllByRole('option', { name: /value/ })).toHaveLength(3);
    }));
    it('facets labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(UnthemedLokiLabelBrowser, Object.assign({}, props)));
        // Selecting label2 and label1
        const label2 = yield screen.findByRole('option', { name: /label2/, selected: false });
        yield userEvent.click(label2);
        const label1 = yield screen.findByRole('option', { name: /label1/, selected: false });
        yield userEvent.click(label1);
        yield screen.findByLabelText('Values for label1');
        yield screen.findByLabelText('Values for label2');
        expect(yield screen.findAllByRole('option', { name: /value/ })).toHaveLength(4);
        expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3');
        // Click value1-1 which triggers facetting for value3-x, and still show all value1-x
        const value1 = yield screen.findByRole('option', { name: 'value1-1', selected: false });
        yield userEvent.click(value1);
        yield waitFor(() => expect(screen.queryByRole('option', { name: 'value2-2' })).not.toBeInTheDocument());
        expect(screen.queryByRole('option', { name: 'value1-2' })).toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1="value1-1"}');
        expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3 (1)');
        // Click value1-2 for which facetting will allow more values for value3-x
        const value12 = yield screen.findByRole('option', { name: 'value1-2', selected: false });
        yield userEvent.click(value12);
        yield screen.findByRole('option', { name: 'value1-2', selected: true });
        yield userEvent.click(screen.getByRole('option', { name: /label3/ }));
        yield screen.findByLabelText('Values for label3');
        expect(screen.queryByRole('option', { name: 'value1-1', selected: true })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'value1-2', selected: true })).toBeInTheDocument();
        expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1=~"value1-1|value1-2"}');
        expect(screen.queryAllByRole('option', { name: /label3/ })[0]).toHaveTextContent('label3 (2)');
    }));
});
//# sourceMappingURL=LokiLabelBrowser.test.js.map