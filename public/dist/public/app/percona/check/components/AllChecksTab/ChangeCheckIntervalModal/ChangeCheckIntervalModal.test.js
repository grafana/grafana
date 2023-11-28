import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
jest.mock('../../../Check.service');
jest.mock('app/core/app_events', () => {
    return {
        appEvents: {
            emit: jest.fn(),
        },
    };
});
const TEST_CHECK = {
    summary: 'Test',
    name: 'test',
    interval: 'STANDARD',
    description: 'test description',
    disabled: false,
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
};
describe('ChangeCheckIntervalModal', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should render modal', () => {
        render(React.createElement(ChangeCheckIntervalModal, { check: TEST_CHECK, onClose: jest.fn(), onIntervalChanged: jest.fn() }));
        expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('change-check-interval-form')).toBeInTheDocument();
        expect(screen.getByTestId('change-check-interval-radio-group-wrapper')).toBeInTheDocument();
    });
    it('should call onClose', () => {
        const onClose = jest.fn();
        render(React.createElement(ChangeCheckIntervalModal, { onIntervalChanged: jest.fn(), check: TEST_CHECK, onClose: onClose }));
        const modalBackground = screen.getByTestId('modal-background');
        fireEvent.click(modalBackground);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('should call onClose and onIntervalChanged on submit', () => __awaiter(void 0, void 0, void 0, function* () {
        const onClose = jest.fn();
        const onIntervalChanged = jest.fn();
        render(React.createElement(ChangeCheckIntervalModal, { onIntervalChanged: onIntervalChanged, check: TEST_CHECK, onClose: onClose }));
        const form = screen.getByTestId('change-check-interval-form');
        fireEvent.submit(form);
        yield waitFor(() => expect(onIntervalChanged).toHaveBeenCalled());
    }));
});
//# sourceMappingURL=ChangeCheckIntervalModal.test.js.map