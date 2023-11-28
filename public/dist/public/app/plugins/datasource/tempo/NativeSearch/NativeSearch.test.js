import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NativeSearch from './NativeSearch';
const getOptionsV1 = jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                {
                    value: 'customer',
                    label: 'customer',
                },
                {
                    value: 'driver',
                    label: 'driver',
                },
            ]);
        }, 1000);
    });
});
// Have to mock CodeEditor else it causes act warnings
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor({ value, onSave }) {
        return React.createElement("input", { "data-testid": "mockeditor", value: value, onChange: (event) => onSave(event.target.value) });
    } })));
jest.mock('../language_provider', () => {
    return jest.fn().mockImplementation(() => {
        return { getOptionsV1 };
    });
});
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: jest.fn(),
        containsTemplate: (val) => {
            return val.includes('$');
        },
    }) })));
let mockQuery = {
    refId: 'A',
    queryType: 'nativeSearch',
    key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
    serviceName: 'driver',
    spanName: 'customer',
};
describe('NativeSearch', () => {
    let user;
    beforeEach(() => {
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should show loader when there is a delay', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NativeSearch, { datasource: {}, query: mockQuery, onChange: jest.fn(), onRunQuery: jest.fn() }));
        const select = screen.getByRole('combobox', { name: 'select-service-name' });
        yield user.click(select);
        const loader = screen.getByText('Loading options...');
        expect(loader).toBeInTheDocument();
        jest.advanceTimersByTime(1000);
        yield waitFor(() => expect(screen.queryByText('Loading options...')).not.toBeInTheDocument());
    }));
    it('should call the `onChange` function on click of the Input', () => __awaiter(void 0, void 0, void 0, function* () {
        const promise = Promise.resolve();
        const handleOnChange = jest.fn(() => promise);
        const fakeOptionChoice = {
            key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
            queryType: 'nativeSearch',
            refId: 'A',
            serviceName: 'driver',
            spanName: 'customer',
        };
        render(React.createElement(NativeSearch, { datasource: {}, query: mockQuery, onChange: handleOnChange, onRunQuery: () => { } }));
        const select = yield screen.findByRole('combobox', { name: 'select-service-name' });
        expect(select).toBeInTheDocument();
        yield user.click(select);
        jest.advanceTimersByTime(1000);
        yield user.type(select, 'd');
        const driverOption = yield screen.findByText('driver');
        yield user.click(driverOption);
        expect(handleOnChange).toHaveBeenCalledWith(fakeOptionChoice);
    }));
    it('should filter the span dropdown when user types a search value', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NativeSearch, { datasource: {}, query: mockQuery, onChange: () => { }, onRunQuery: () => { } }));
        const select = yield screen.findByRole('combobox', { name: 'select-service-name' });
        yield user.click(select);
        jest.advanceTimersByTime(1000);
        expect(select).toBeInTheDocument();
        yield user.type(select, 'd');
        let option = yield screen.findByText('driver');
        expect(option).toBeDefined();
        yield user.type(select, 'a');
        option = yield screen.findByText('Hit enter to add');
        expect(option).toBeDefined();
    }));
    it('should add variable to select menu options', () => __awaiter(void 0, void 0, void 0, function* () {
        mockQuery = Object.assign(Object.assign({}, mockQuery), { refId: '121314', serviceName: '$service', spanName: '$span' });
        render(React.createElement(NativeSearch, { datasource: {}, query: mockQuery, onChange: () => { }, onRunQuery: () => { } }));
        const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
        expect(asyncServiceSelect).toBeInTheDocument();
        yield user.click(asyncServiceSelect);
        jest.advanceTimersByTime(3000);
        yield user.type(asyncServiceSelect, '$');
        const serviceOption = yield screen.findByText('$service');
        expect(serviceOption).toBeDefined();
        const asyncSpanSelect = screen.getByRole('combobox', { name: 'select-span-name' });
        expect(asyncSpanSelect).toBeInTheDocument();
        yield user.click(asyncSpanSelect);
        jest.advanceTimersByTime(3000);
        yield user.type(asyncSpanSelect, '$');
        const operationOption = yield screen.findByText('$span');
        expect(operationOption).toBeDefined();
    }));
});
//# sourceMappingURL=NativeSearch.test.js.map