import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FilterFieldTypes } from '..';
import { Filter } from './Filter';
import { SEARCH_INPUT_FIELD_NAME, SEARCH_SELECT_FIELD_NAME } from './Filter.constants';
import * as filterUtils from './Filter.utils';
const Messages = {
    name: 'Name',
    description: 'Description',
    disabled: 'Status',
    interval: 'Interval',
};
const columns = [
    {
        Header: Messages.name,
        accessor: 'summary',
        type: FilterFieldTypes.TEXT,
    },
    {
        Header: Messages.description,
        accessor: 'description',
        type: FilterFieldTypes.TEXT,
    },
    {
        Header: Messages.disabled,
        accessor: 'disabled',
        type: FilterFieldTypes.RADIO_BUTTON,
        label: 'Test',
        options: [
            {
                label: 'Enabled',
                value: false,
            },
            {
                label: 'Disabled',
                value: true,
            },
        ],
    },
    {
        Header: Messages.interval,
        accessor: 'interval',
        type: FilterFieldTypes.DROPDOWN,
        options: [
            {
                label: 'Standard',
                value: 'Standard',
            },
            {
                label: 'Rare',
                value: 'Rare',
            },
            {
                label: 'Frequent',
                value: 'Frequent',
            },
        ],
    },
];
const data = [
    {
        name: 'test1',
        description: 'Test desctiption 1',
        summary: 'Test summary 1',
        interval: 'interval 1',
        disabled: false,
    },
    {
        name: 'test2',
        description: 'Test desctiption 2',
        summary: 'Test summary 2',
        interval: 'interval 2',
        disabled: false,
    },
    {
        name: 'test3',
        description: 'Test desctiption 3',
        summary: 'Test summary 3',
        interval: 'interval 3',
        disabled: true,
    },
];
jest.mock('react-router-dom', () => (Object.assign(Object.assign({}, jest.requireActual('react-router-dom')), { useLocation: () => ({
        pathname: 'http://localhost/graph/pmm-database-checks/all-checks',
    }) })));
const setFilteredData = jest.fn();
describe('Filter', () => {
    beforeEach(() => {
        // There's a warning about keys coming from within ReactFinalForm
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    it('should render the filter', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        expect(screen.getByTestId('advance-filter-button')).toBeInTheDocument();
        expect(screen.getByTestId('clear-all-button')).toBeInTheDocument();
        expect(screen.getByTestId('filter')).toBeInTheDocument();
    }));
    it('should open correctly text fields', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        fireEvent.click(screen.getByTestId('open-search-fields'));
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
    }));
    it('should correctly show init data in text fields from url query', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(filterUtils, 'getQueryParams')
            .mockImplementation(() => ({ [SEARCH_SELECT_FIELD_NAME]: 'summary', [SEARCH_INPUT_FIELD_NAME]: 'data' }));
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
        expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toHaveValue('data');
    }));
    it('should correctly show init data in advance filter fields from url query', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(filterUtils, 'getQueryParams').mockImplementation(() => ({ disabled: 'true', interval: 'Rare' }));
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        expect(screen.getByText('Rare')).toBeInTheDocument();
        expect(screen.getByTestId('disabled-radio-state')).toBeInTheDocument();
        expect(screen.getByTestId('disabled-radio-state')).toHaveValue('true');
    }));
    it('should show only text fields when only text fields are set', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(filterUtils, 'getQueryParams')
            .mockImplementation(() => ({ [SEARCH_SELECT_FIELD_NAME]: 'summary', [SEARCH_INPUT_FIELD_NAME]: 'data' }));
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
        expect(screen.queryByText('Rare')).not.toBeInTheDocument();
        expect(screen.queryByTestId('disabled-radio-state')).not.toBeInTheDocument();
    }));
    it('should show only advance filter fields when only advance filter fields are set', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(filterUtils, 'getQueryParams').mockImplementation(() => ({ disabled: 'true', interval: 'Rare' }));
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: false }));
        expect(screen.queryByText('Name')).not.toBeInTheDocument();
        expect(screen.queryByTestId(SEARCH_INPUT_FIELD_NAME)).not.toBeInTheDocument();
        expect(screen.getByText('Rare')).toBeInTheDocument();
        expect(screen.getByTestId('disabled-radio-state')).toBeInTheDocument();
    }));
    it('should show apply button when backend filtering is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Filter, { columns: columns, rawData: data, setFilteredData: setFilteredData, hasBackendFiltering: true }));
        expect(screen.queryByTestId('submit-button'));
    }));
});
//# sourceMappingURL=Filter.test.js.map