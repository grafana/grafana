import { __awaiter } from "tslib";
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import * as api from 'app/features/manage-dashboards/state/actions';
import { SaveDashboardAsForm } from './SaveDashboardAsForm';
jest.mock('app/features/plugins/datasource_srv', () => ({}));
jest.mock('app/features/expressions/ExpressionDatasource', () => ({}));
jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
    validationSrv: {
        validateNewDashboardName: () => true,
    },
}));
jest.spyOn(api, 'searchFolders').mockResolvedValue([]);
const prepareDashboardMock = (panel) => {
    const json = {
        title: 'name',
        panels: [panel],
        tags: ['tag1', 'tag2'],
    };
    return Object.assign(Object.assign({ id: 5, meta: {} }, json), { getSaveModelClone: () => json });
};
const renderAndSubmitForm = (dashboard, submitSpy, otherProps = {}) => __awaiter(void 0, void 0, void 0, function* () {
    render(React.createElement(SaveDashboardAsForm, Object.assign({ isLoading: false, dashboard: dashboard, onCancel: () => { }, onSuccess: () => { }, onSubmit: (jsonModel) => __awaiter(void 0, void 0, void 0, function* () {
            submitSpy(jsonModel);
            return {};
        }) }, otherProps)));
    const button = screen.getByRole('button', { name: 'Save dashboard button' });
    yield userEvent.click(button);
});
describe('SaveDashboardAsForm', () => {
    describe('default values', () => {
        it('applies default dashboard properties', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(api, 'searchFolders').mockResolvedValue([]);
            const spy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock({}), spy, {
                isNew: true,
            });
            expect(spy).toBeCalledTimes(1);
            const savedDashboardModel = spy.mock.calls[0][0];
            expect(savedDashboardModel.id).toBe(null);
            expect(savedDashboardModel.title).toBe('name');
            expect(savedDashboardModel.editable).toBe(true);
            expect(savedDashboardModel.tags).toEqual(['tag1', 'tag2']);
        }));
        it("appends 'Copy' to the name when the dashboard isnt new", () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(api, 'searchFolders').mockResolvedValue([]);
            const spy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock({}), spy, {
                isNew: false,
            });
            expect(spy).toBeCalledTimes(1);
            const savedDashboardModel = spy.mock.calls[0][0];
            expect(savedDashboardModel.title).toBe('name Copy');
            // when copying a dashboard, the tags should be empty
            expect(savedDashboardModel.tags).toEqual([]);
        }));
    });
    describe('graph panel', () => {
        const panel = {
            id: 1,
            type: 'graph',
            alert: { rule: 1 },
            thresholds: { value: 3000 },
        };
        it('should remove alerts and thresholds from  panel', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock(panel), spy);
            expect(spy).toBeCalledTimes(1);
            const savedDashboardModel = spy.mock.calls[0][0];
            expect(savedDashboardModel.panels[0]).toEqual({ id: 1, type: 'graph' });
        }));
    });
    describe('singestat panel', () => {
        const panel = { id: 1, type: 'singlestat', thresholds: { value: 3000 } };
        it('should keep thresholds', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock(panel), spy);
            expect(spy).toBeCalledTimes(1);
            const savedDashboardModel = spy.mock.calls[0][0];
            expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
        }));
    });
    describe('table panel', () => {
        const panel = { id: 1, type: 'table', thresholds: { value: 3000 } };
        it('should keep thresholds', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.fn();
            yield renderAndSubmitForm(prepareDashboardMock(panel), spy);
            expect(spy).toBeCalledTimes(1);
            const savedDashboardModel = spy.mock.calls[0][0];
            expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
        }));
    });
});
//# sourceMappingURL=SaveDashboardAsForm.test.js.map