import { __awaiter, __rest } from "tslib";
import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../../../store/configureStore';
import DBaaSBackups from './DBaaSBackups';
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
const store = configureStore({
    percona: {
        user: { isAuthorized: true },
        kubernetes: {
            loading: false,
        },
    },
});
describe('DBaaSBackups Scheduled Section ::', () => {
    it('renders items correctly, shows fields on switch on', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: store },
            React.createElement(Form, { onSubmit: jest.fn(), initialValues: {
                    day: [],
                    month: [],
                    period: { value: 'year', label: 'every year' },
                    startHour: [{ label: '00', value: 0 }],
                    startMinute: [{ value: 0, label: '00' }],
                    weekDay: [],
                }, render: (_a) => {
                    var { form, handleSubmit, pristine, valid } = _a, props = __rest(_a, ["form", "handleSubmit", "pristine", "valid"]);
                    return (React.createElement(DBaaSBackups, Object.assign({ handleSubmit: handleSubmit, pristine: pristine, valid: valid, form: form }, props)));
                } }))));
        expect(screen.getByTestId('toggle-scheduled-backup')).toBeInTheDocument();
        const checkbox = screen.getByTestId('toggle-scheduled-backup');
        fireEvent.click(checkbox);
        expect(screen.getByTestId('location-select-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('retention-field-container')).toBeInTheDocument();
        expect(screen.getByTestId('shedule-section-fields-wrapper')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=DBaaSBackups.test.js.map