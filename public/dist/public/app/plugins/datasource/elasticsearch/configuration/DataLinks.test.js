import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DataLinks } from './DataLinks';
const setup = (propOverrides) => {
    const props = Object.assign({ value: [], onChange: jest.fn() }, propOverrides);
    return render(React.createElement(DataLinks, Object.assign({}, props)));
};
describe('DataLinks tests', () => {
    it('should render correctly with no fields', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.getByRole('heading', { name: 'Data links' }));
        expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
        expect(yield screen.findAllByRole('button')).toHaveLength(1);
    }));
    it('should render correctly when passed fields', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ value: testValue });
        expect(yield screen.findAllByRole('button', { name: 'Remove field' })).toHaveLength(2);
        expect(yield screen.findAllByRole('checkbox', { name: 'Internal link' })).toHaveLength(2);
    }));
    it('should call onChange to add a new field when the add button is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeMock = jest.fn();
        setup({ onChange: onChangeMock });
        expect(onChangeMock).not.toHaveBeenCalled();
        const addButton = screen.getByRole('button', { name: 'Add' });
        yield userEvent.click(addButton);
        expect(onChangeMock).toHaveBeenCalled();
    }));
    it('should call onChange to remove a field when the remove button is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeMock = jest.fn();
        setup({ value: testValue, onChange: onChangeMock });
        expect(onChangeMock).not.toHaveBeenCalled();
        const removeButton = yield screen.findAllByRole('button', { name: 'Remove field' });
        yield userEvent.click(removeButton[0]);
        expect(onChangeMock).toHaveBeenCalled();
    }));
});
const testValue = [
    {
        field: 'regex1',
        url: 'localhost1',
    },
    {
        field: 'regex2',
        url: 'localhost2',
    },
];
//# sourceMappingURL=DataLinks.test.js.map