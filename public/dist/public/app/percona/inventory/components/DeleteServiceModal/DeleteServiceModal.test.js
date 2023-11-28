import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as ServicesReducer from 'app/percona/shared/core/reducers/services/services';
import { configureStore } from 'app/store/configureStore';
import DeleteServiceModal from './DeleteServiceModal';
const cancelFn = jest.fn();
const successFn = jest.fn();
const removeServiceActionSpy = jest.spyOn(ServicesReducer, 'removeServiceAction');
jest.mock('app/percona/inventory/Inventory.service');
jest.mock('app/percona/shared/services/services/Services.service');
const renderDefaults = (isOpen = true) => render(React.createElement(Provider, { store: configureStore() },
    React.createElement(DeleteServiceModal, { onCancel: cancelFn, onSuccess: successFn, isOpen: isOpen, serviceId: "service_id", serviceName: "service_name" })));
describe('DeleteServiceModal::', () => {
    beforeEach(() => {
        removeServiceActionSpy.mockClear();
        cancelFn.mockClear();
        successFn.mockClear();
    });
    it("doesn't render if not opened", () => {
        renderDefaults(false);
        expect(screen.queryByTestId('delete-service-description')).toBe(null);
    });
    it('renders when opened', () => {
        renderDefaults();
        expect(screen.queryByTestId('delete-service-description')).toBeInTheDocument();
    });
    it('can be cancelled', () => {
        renderDefaults();
        const cancelButton = screen.getByTestId('delete-service-cancel');
        fireEvent.click(cancelButton);
        expect(cancelFn).toHaveBeenCalled();
    });
    it('calls delete', () => {
        renderDefaults();
        const confirmButton = screen.getByTestId('delete-service-confirm');
        fireEvent.click(confirmButton);
        expect(removeServiceActionSpy).toHaveBeenCalledWith({
            force: false,
            serviceId: 'service_id',
        });
    });
    it('call on success after deletion', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefaults();
        const confirmButton = screen.getByTestId('delete-service-confirm');
        fireEvent.click(confirmButton);
        yield waitFor(() => expect(successFn).toHaveBeenCalled());
    }));
    it('calls delete with force mode', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefaults();
        const forceModeCheck = screen.getByTestId('delete-service-force-mode');
        yield waitFor(() => fireEvent.click(forceModeCheck));
        const confirmButton = screen.getByTestId('delete-service-confirm');
        yield waitFor(() => fireEvent.click(confirmButton));
        expect(removeServiceActionSpy).toHaveBeenCalledWith({
            force: true,
            serviceId: 'service_id',
        });
    }));
    it('resets force mode after submit', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefaults();
        const forceModeCheck = screen.getByTestId('delete-service-force-mode');
        yield waitFor(() => fireEvent.click(forceModeCheck));
        expect(forceModeCheck).toBeChecked();
        const confirmButton = screen.getByTestId('delete-service-confirm');
        fireEvent.click(confirmButton);
        yield waitFor(() => expect(forceModeCheck).not.toBeChecked());
    }));
    it('resets force mode after dismiss', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefaults();
        const forceModeCheck = screen.getByTestId('delete-service-force-mode');
        yield waitFor(() => fireEvent.click(forceModeCheck));
        expect(forceModeCheck).toBeChecked();
        const cancelButton = screen.getByTestId('delete-service-cancel');
        fireEvent.click(cancelButton);
        yield waitFor(() => expect(forceModeCheck).not.toBeChecked());
    }));
});
//# sourceMappingURL=DeleteServiceModal.test.js.map