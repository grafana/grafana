import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LocationType } from '../StorageLocations.types';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
describe('RemoveStorageLocationModal', () => {
    it('should have a WarningBlock and CheckboxField', () => __awaiter(void 0, void 0, void 0, function* () {
        const location = {
            locationID: 'ID1',
            name: 'Location_1',
            description: 'description',
            type: LocationType.CLIENT,
            path: '/foo',
        };
        render(React.createElement(RemoveStorageLocationModal, { isVisible: true, location: location, loading: false, setVisible: jest.fn(), onDelete: jest.fn() }));
        expect(screen.getByTestId('warning-block')).toBeInTheDocument();
        expect(screen.getByTestId('force-checkbox-input')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=RemoveStorageLocationModal.test.js.map