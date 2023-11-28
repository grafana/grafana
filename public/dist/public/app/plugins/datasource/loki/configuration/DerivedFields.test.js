import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DerivedFields } from './DerivedFields';
describe('DerivedFields', () => {
    let originalGetSelection;
    beforeAll(() => {
        originalGetSelection = window.getSelection;
        window.getSelection = () => null;
    });
    afterAll(() => {
        window.getSelection = originalGetSelection;
    });
    it('renders correctly when no fields', () => {
        render(React.createElement(DerivedFields, { onChange: () => { } }));
        expect(screen.getByText('Add')).toBeInTheDocument();
        expect(screen.queryByText(/example log message/)).not.toBeInTheDocument();
        expect(screen.queryByTestId('derived-field')).not.toBeInTheDocument();
    });
    it('renders correctly when there are fields', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DerivedFields, { fields: testFields, onChange: () => { } }));
        yield waitFor(() => expect(screen.getAllByTestId('derived-field')).toHaveLength(2));
        expect(screen.getByText('Add')).toBeInTheDocument();
        expect(screen.getByText('Show example log message')).toBeInTheDocument();
    }));
    it('adds a new field', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(DerivedFields, { onChange: onChange }));
        userEvent.click(screen.getByText('Add'));
        yield waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    }));
    it('removes a field', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(DerivedFields, { fields: testFields, onChange: onChange }));
        userEvent.click((yield screen.findAllByTitle('Remove field'))[0]);
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith([testFields[1]]));
    }));
    it('validates duplicated field names', () => __awaiter(void 0, void 0, void 0, function* () {
        const repeatedFields = [
            {
                matcherRegex: '',
                name: 'repeated',
            },
            {
                matcherRegex: '',
                name: 'repeated',
            },
        ];
        render(React.createElement(DerivedFields, { onChange: jest.fn(), fields: repeatedFields }));
        userEvent.click(screen.getAllByPlaceholderText('Field name')[0]);
        expect(yield screen.findAllByText('The name is already in use')).toHaveLength(2);
    }));
    it('does not validate empty names as repeated', () => {
        const repeatedFields = [
            {
                matcherRegex: '',
                name: '',
            },
            {
                matcherRegex: '',
                name: '',
            },
        ];
        render(React.createElement(DerivedFields, { onChange: jest.fn(), fields: repeatedFields }));
        userEvent.click(screen.getAllByPlaceholderText('Field name')[0]);
        expect(screen.queryByText('The name is already in use')).not.toBeInTheDocument();
    });
});
const testFields = [
    {
        matcherRegex: 'regex1',
        name: 'test1',
        url: 'localhost1',
    },
    {
        matcherRegex: 'regex2',
        name: 'test2',
        url: 'localhost2',
    },
];
//# sourceMappingURL=DerivedFields.test.js.map