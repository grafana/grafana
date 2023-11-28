import { __awaiter } from "tslib";
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { SaveDashboardForm } from './SaveDashboardForm';
const prepareDashboardMock = (timeChanged, variableValuesChanged, resetTimeSpy, resetVarsSpy) => {
    const json = {
        title: 'name',
        id: 5,
        schemaVersion: 30,
    };
    return Object.assign(Object.assign({}, json), { meta: {}, hasTimeChanged: jest.fn().mockReturnValue(timeChanged), hasVariablesChanged: jest.fn().mockReturnValue(variableValuesChanged), resetOriginalTime: () => resetTimeSpy(), resetOriginalVariables: () => resetVarsSpy(), getSaveModelClone: () => json });
};
const renderAndSubmitForm = (dashboard, submitSpy) => __awaiter(void 0, void 0, void 0, function* () {
    render(React.createElement(SaveDashboardForm, { isLoading: false, dashboard: dashboard, onCancel: () => { }, onSuccess: () => { }, onSubmit: (jsonModel) => __awaiter(void 0, void 0, void 0, function* () {
            submitSpy(jsonModel);
            return { status: 'success' };
        }), saveModel: {
            clone: dashboard.getSaveModelClone(),
            diff: {},
            diffCount: 0,
            hasChanges: true,
        }, options: {}, onOptionsChange: (opts) => {
            return;
        } }));
    const button = screen.getByRole('button', { name: 'Dashboard settings Save Dashboard Modal Save button' });
    yield userEvent.click(button);
});
describe('SaveDashboardAsForm', () => {
    describe('time and variables toggle rendering', () => {
        it('renders switches when variables or timerange', () => {
            render(React.createElement(SaveDashboardForm, { isLoading: false, dashboard: prepareDashboardMock(true, true, jest.fn(), jest.fn()), onCancel: () => { }, onSuccess: () => { }, onSubmit: () => __awaiter(void 0, void 0, void 0, function* () {
                    return {};
                }), saveModel: {
                    clone: { id: 1, schemaVersion: 3 },
                    diff: {},
                    diffCount: 0,
                    hasChanges: true,
                }, options: {}, onOptionsChange: (opts) => {
                    return;
                } }));
            const variablesCheckbox = screen.getByRole('checkbox', {
                name: 'Dashboard settings Save Dashboard Modal Save variables checkbox',
            });
            const timeRangeCheckbox = screen.getByRole('checkbox', {
                name: 'Dashboard settings Save Dashboard Modal Save timerange checkbox',
            });
            expect(variablesCheckbox).toBeInTheDocument();
            expect(timeRangeCheckbox).toBeInTheDocument();
        });
    });
    describe("when time and template vars haven't changed", () => {
        it("doesn't reset dashboard time and vars", () => __awaiter(void 0, void 0, void 0, function* () {
            const resetTimeSpy = jest.fn();
            const resetVarsSpy = jest.fn();
            const submitSpy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock(false, false, resetTimeSpy, resetVarsSpy), submitSpy);
            expect(resetTimeSpy).not.toBeCalled();
            expect(resetVarsSpy).not.toBeCalled();
            expect(submitSpy).toBeCalledTimes(1);
        }));
    });
    describe('when time and template vars have changed', () => {
        describe("and user hasn't checked variable and time range save", () => {
            it('dont reset dashboard time and vars', () => __awaiter(void 0, void 0, void 0, function* () {
                const resetTimeSpy = jest.fn();
                const resetVarsSpy = jest.fn();
                const submitSpy = jest.fn();
                yield renderAndSubmitForm(prepareDashboardMock(true, true, resetTimeSpy, resetVarsSpy), submitSpy);
                expect(resetTimeSpy).toBeCalledTimes(0);
                expect(resetVarsSpy).toBeCalledTimes(0);
                expect(submitSpy).toBeCalledTimes(1);
            }));
        });
    });
    describe('saved message draft rendered', () => {
        it('renders saved message draft if it was filled before', () => {
            render(React.createElement(SaveDashboardForm, { isLoading: false, dashboard: createDashboardModelFixture(), onCancel: () => { }, onSuccess: () => { }, onSubmit: () => __awaiter(void 0, void 0, void 0, function* () {
                    return {};
                }), saveModel: {
                    clone: createDashboardModelFixture().getSaveModelClone(),
                    diff: {},
                    diffCount: 0,
                    hasChanges: true,
                }, options: { message: 'Saved draft' }, onOptionsChange: (opts) => {
                    return;
                } }));
            const messageTextArea = screen.getByLabelText('message');
            expect(messageTextArea).toBeInTheDocument();
            expect(messageTextArea).toHaveTextContent('Saved draft');
        });
    });
});
//# sourceMappingURL=SaveDashboardForm.test.js.map