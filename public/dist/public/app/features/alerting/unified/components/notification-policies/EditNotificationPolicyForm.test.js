import { __awaiter } from "tslib";
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { byRole } from 'testing-library-selector';
import { Button } from '@grafana/ui';
import { TestProvider } from '../../../../../../test/helpers/TestProvider';
import * as grafanaApp from '../../components/receivers/grafanaAppReceivers/grafanaApp';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { AmRoutesExpandedForm } from './EditNotificationPolicyForm';
const ui = {
    error: byRole('alert'),
    overrideTimingsCheckbox: byRole('checkbox', { name: /Override general timings/ }),
    submitBtn: byRole('button', { name: /Update default policy/ }),
    groupWaitInput: byRole('textbox', { name: /Group wait/ }),
    groupIntervalInput: byRole('textbox', { name: /Group interval/ }),
    repeatIntervalInput: byRole('textbox', { name: /Repeat interval/ }),
};
const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);
// TODO Default and Notification policy form should be unified so we don't need to maintain two almost identical forms
describe('EditNotificationPolicyForm', function () {
    describe('Timing options', function () {
        it('should render prometheus duration strings in form inputs', function () {
            return __awaiter(this, void 0, void 0, function* () {
                renderRouteForm({
                    id: '1',
                    group_wait: '1m30s',
                    group_interval: '2d4h30m35s',
                    repeat_interval: '1w2d6h',
                });
                expect(ui.overrideTimingsCheckbox.get()).toBeChecked();
                expect(ui.groupWaitInput.get()).toHaveValue('1m30s');
                expect(ui.groupIntervalInput.get()).toHaveValue('2d4h30m35s');
                expect(ui.repeatIntervalInput.get()).toHaveValue('1w2d6h');
            });
        });
        it('should allow submitting valid prometheus duration strings', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const user = userEvent.setup();
                const onSubmit = jest.fn();
                renderRouteForm({
                    id: '1',
                    receiver: 'default',
                }, [{ value: 'default', label: 'Default' }], onSubmit);
                yield user.click(ui.overrideTimingsCheckbox.get());
                yield user.type(ui.groupWaitInput.get(), '5m25s');
                yield user.type(ui.groupIntervalInput.get(), '35m40s');
                yield user.type(ui.repeatIntervalInput.get(), '4h30m');
                yield user.click(ui.submitBtn.get());
                expect(ui.error.queryAll()).toHaveLength(0);
                expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
                    groupWaitValue: '5m25s',
                    groupIntervalValue: '35m40s',
                    repeatIntervalValue: '4h30m',
                }), expect.anything());
            });
        });
    });
    it('should show an error if repeat interval is lower than group interval', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            renderRouteForm({
                id: '1',
                receiver: 'default',
            }, [{ value: 'default', label: 'Default' }], onSubmit);
            yield user.click(ui.overrideTimingsCheckbox.get());
            yield user.type(ui.groupWaitInput.get(), '5m25s');
            yield user.type(ui.groupIntervalInput.get(), '35m40s');
            yield user.type(ui.repeatIntervalInput.get(), '30m');
            yield user.click(ui.submitBtn.get());
            expect(ui.error.getAll()).toHaveLength(1);
            expect(ui.error.get().textContent).toBe('Repeat interval should be higher or equal to Group interval');
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });
    it('should allow resetting existing timing options', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            renderRouteForm({
                id: '0',
                receiver: 'default',
                group_wait: '1m30s',
                group_interval: '2d4h30m35s',
                repeat_interval: '1w2d6h',
            }, [{ value: 'default', label: 'Default' }], onSubmit);
            yield user.clear(ui.groupWaitInput.get());
            yield user.clear(ui.groupIntervalInput.get());
            yield user.clear(ui.repeatIntervalInput.get());
            yield user.click(ui.submitBtn.get());
            expect(ui.error.queryAll()).toHaveLength(0);
            expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
                groupWaitValue: '',
                groupIntervalValue: '',
                repeatIntervalValue: '',
            }), expect.anything());
        });
    });
});
function renderRouteForm(route, receivers = [], onSubmit = noop) {
    render(React.createElement(AlertmanagerProvider, { accessType: "instance" },
        React.createElement(AmRoutesExpandedForm, { actionButtons: React.createElement(Button, { type: "submit" }, "Update default policy"), onSubmit: onSubmit, receivers: receivers, route: route })), { wrapper: TestProvider });
}
//# sourceMappingURL=EditNotificationPolicyForm.test.js.map