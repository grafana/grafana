import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { AsyncSelectFieldCore } from './AsyncSelectFieldCore';
import { generateOptions } from './__mocks__/mockAsyncSelectOptions';
const { email, minLength } = validators;
describe('AsyncSelectField::', () => {
    const getOptions = (timeout = 10) => jest.fn().mockReturnValue(new Promise((resolve) => setTimeout(() => resolve(generateOptions()), timeout)));
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });
    it('should render a field container with input', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(FormWrapper, null,
            React.createElement(AsyncSelectFieldCore, { name: "test" })));
        expect(screen.getByTestId('test-field-container'));
        expect(container.querySelector('input')).toBeInTheDocument();
    }));
    it('should render a label', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(AsyncSelectFieldCore, { name: "test", label: "test label" })));
        expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label');
    });
    it('should show the loader', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(AsyncSelectFieldCore, { defaultOptions: true, name: "test", label: "test label", loadOptions: getOptions(), isOpen: true })));
        expect(screen.getByTestId('test-field-container').children[1]).toHaveTextContent('Choose');
        expect(screen.getByTestId('Spinner')).toBeInTheDocument();
        yield waitFor(() => {
            expect(screen.getAllByLabelText('Select option')).toHaveLength(4);
        });
    }));
    it('should react on multiple validators', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(AsyncSelectFieldCore, { defaultOptions: true, name: "test", label: "test-label", validators: [email, minLength(13)], loadOptions: getOptions(), isOpen: true })));
        const menuOptions = yield waitFor(() => screen.getAllByLabelText('Select option'));
        fireEvent.click(menuOptions[0]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Must contain at least 13 characters');
        fireEvent.click(menuOptions[1]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Invalid email address');
        fireEvent.click(menuOptions[2]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('');
    }));
    it('should show an error below the input', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(AsyncSelectFieldCore, { defaultOptions: true, name: "test", label: "test-label", validators: [minLength(13)], loadOptions: getOptions(), isOpen: true })));
        const menuOptions = yield waitFor(() => screen.getAllByLabelText('Select option'));
        fireEvent.click(menuOptions[0]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Must contain at least 13 characters');
    }));
});
//# sourceMappingURL=AsyncSelectFieldCore.test.js.map