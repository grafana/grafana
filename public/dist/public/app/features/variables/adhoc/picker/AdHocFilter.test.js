import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';
import { setDataSourceSrv } from '@grafana/runtime';
import { AdHocFilter } from './AdHocFilter';
describe('AdHocFilter', () => {
    it('renders filters', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.getByText('key1')).toBeInTheDocument();
        expect(screen.getByText('val1')).toBeInTheDocument();
        expect(screen.getByText('key2')).toBeInTheDocument();
        expect(screen.getByText('val2')).toBeInTheDocument();
        expect(screen.getByLabelText('Add Filter')).toBeInTheDocument();
    }));
    it('adds filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const { addFilter } = setup();
        // Select key
        yield userEvent.click(screen.getByLabelText('Add Filter'));
        const selectEl = screen.getByTestId('AdHocFilterKey-add-key-wrapper');
        expect(selectEl).toBeInTheDocument();
        yield selectEvent.select(selectEl, 'key3', { container: document.body });
        // Select value
        yield userEvent.click(screen.getByText('Select value'));
        // There are already some filters rendered
        const selectEl2 = screen.getAllByTestId('AdHocFilterValue-value-wrapper')[2];
        yield selectEvent.select(selectEl2, 'val3', { container: document.body });
        // Only after value is selected the addFilter is called
        expect(addFilter).toBeCalled();
    }));
    it('removes filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const { removeFilter } = setup();
        // Select key
        yield userEvent.click(screen.getByText('key1'));
        const selectEl = screen.getAllByTestId('AdHocFilterKey-key-wrapper')[0];
        expect(selectEl).toBeInTheDocument();
        yield selectEvent.select(selectEl, '-- remove filter --', { container: document.body });
        // Only after value is selected the addFilter is called
        expect(removeFilter).toBeCalled();
    }));
    it('changes filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const { changeFilter } = setup();
        // Select key
        yield userEvent.click(screen.getByText('val1'));
        const selectEl = screen.getAllByTestId('AdHocFilterValue-value-wrapper')[0];
        expect(selectEl).toBeInTheDocument();
        yield selectEvent.select(selectEl, 'val4', { container: document.body });
        // Only after value is selected the addFilter is called
        expect(changeFilter).toBeCalled();
    }));
});
function setup() {
    setDataSourceSrv({
        get() {
            return {
                getTagKeys() {
                    return [{ text: 'key3' }];
                },
                getTagValues() {
                    return [{ text: 'val3' }, { text: 'val4' }];
                },
            };
        },
    });
    const filters = [
        {
            key: 'key1',
            operator: '=',
            value: 'val1',
        },
        {
            key: 'key2',
            operator: '=',
            value: 'val2',
        },
    ];
    const addFilter = jest.fn();
    const removeFilter = jest.fn();
    const changeFilter = jest.fn();
    render(React.createElement(AdHocFilter, { datasource: { uid: 'test' }, filters: filters, addFilter: addFilter, removeFilter: removeFilter, changeFilter: changeFilter }));
    return { addFilter, removeFilter, changeFilter };
}
//# sourceMappingURL=AdHocFilter.test.js.map