import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { getLabelSelects } from '../testUtils';
import { LabelFilters, MISSING_LABEL_FILTER_ERROR_MESSAGE } from './LabelFilters';
describe('LabelFilters', () => {
    it('renders empty input without labels', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.getAllByText('Select label')).toHaveLength(1);
        expect(screen.getAllByText('Select value')).toHaveLength(1);
        expect(screen.getByText(/=/)).toBeInTheDocument();
        expect(getAddButton()).toBeInTheDocument();
    }));
    it('renders multiple labels', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            labelsFilters: [
                { label: 'foo', op: '=', value: 'bar' },
                { label: 'baz', op: '!=', value: 'qux' },
                { label: 'quux', op: '=~', value: 'quuz' },
            ],
        });
        expect(screen.getByText(/foo/)).toBeInTheDocument();
        expect(screen.getByText(/bar/)).toBeInTheDocument();
        expect(screen.getByText(/baz/)).toBeInTheDocument();
        expect(screen.getByText(/qux/)).toBeInTheDocument();
        expect(screen.getByText(/quux/)).toBeInTheDocument();
        expect(screen.getByText(/quuz/)).toBeInTheDocument();
        expect(getAddButton()).toBeInTheDocument();
    }));
    it('renders multiple values for regex selectors', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            labelsFilters: [
                { label: 'bar', op: '!~', value: 'baz|bat|bau' },
                { label: 'foo', op: '!~', value: 'fop|for|fos' },
            ],
        });
        expect(screen.getByText(/bar/)).toBeInTheDocument();
        expect(screen.getByText(/baz/)).toBeInTheDocument();
        expect(screen.getByText(/bat/)).toBeInTheDocument();
        expect(screen.getByText(/bau/)).toBeInTheDocument();
        expect(screen.getByText(/foo/)).toBeInTheDocument();
        expect(screen.getByText(/for/)).toBeInTheDocument();
        expect(screen.getByText(/fos/)).toBeInTheDocument();
        expect(getAddButton()).toBeInTheDocument();
    }));
    it('adds new label', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
        yield userEvent.click(getAddButton());
        expect(screen.getAllByText('Select label')).toHaveLength(1);
        expect(screen.getAllByText('Select value')).toHaveLength(1);
        const { name, value } = getLabelSelects(1);
        yield selectOptionInTest(name, 'baz');
        yield selectOptionInTest(value, 'qux');
        expect(onChange).toBeCalledWith([
            { label: 'foo', op: '=', value: 'bar' },
            { label: 'baz', op: '=', value: 'qux' },
        ]);
    }));
    it('removes label', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
        yield userEvent.click(screen.getByLabelText(/remove/));
        expect(onChange).toBeCalledWith([]);
    }));
    it('renders empty input when labels are deleted from outside ', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = setup({ labelsFilters: [{ label: 'foo', op: '=', value: 'bar' }] });
        expect(screen.getByText(/foo/)).toBeInTheDocument();
        expect(screen.getByText(/bar/)).toBeInTheDocument();
        rerender(React.createElement(LabelFilters, { onChange: jest.fn(), onGetLabelNames: jest.fn(), onGetLabelValues: jest.fn(), labelsFilters: [] }));
        expect(screen.getAllByText('Select label')).toHaveLength(1);
        expect(screen.getAllByText('Select value')).toHaveLength(1);
        expect(screen.getByText(/=/)).toBeInTheDocument();
        expect(getAddButton()).toBeInTheDocument();
    }));
    it('shows error when filter with empty strings  and label filter is required', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ labelsFilters: [{ label: '', op: '=', value: '' }], labelFilterRequired: true });
        expect(screen.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
    }));
    it('shows error when no filter and label filter is required', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ labelsFilters: [], labelFilterRequired: true });
        expect(screen.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
    }));
});
function setup(propOverrides) {
    const defaultProps = {
        onChange: jest.fn(),
        onGetLabelNames: () => __awaiter(this, void 0, void 0, function* () {
            return [
                { label: 'foo', value: 'foo' },
                { label: 'bar', value: 'bar' },
                { label: 'baz', value: 'baz' },
            ];
        }),
        onGetLabelValues: () => __awaiter(this, void 0, void 0, function* () {
            return [
                { label: 'bar', value: 'bar' },
                { label: 'qux', value: 'qux' },
                { label: 'quux', value: 'quux' },
            ];
        }),
        labelsFilters: [],
    };
    const props = Object.assign(Object.assign({}, defaultProps), propOverrides);
    const { rerender } = render(React.createElement(LabelFilters, Object.assign({}, props)));
    return Object.assign(Object.assign({}, props), { rerender });
}
function getAddButton() {
    return screen.getByLabelText(/Add/);
}
//# sourceMappingURL=LabelFilters.test.js.map