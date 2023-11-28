import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { AddInstance } from './AddInstance';
import { instanceList } from './AddInstance.constants';
jest.mock('app/percona/settings/Settings.service');
const selectedInstanceType = { type: '' };
describe('AddInstance page::', () => {
    it('should render a given number of links', () => __awaiter(void 0, void 0, void 0, function* () {
        const ui = withStore(React.createElement(AddInstance, { showAzure: false, onSelectInstanceType: () => { }, selectedInstanceType: selectedInstanceType }));
        yield waitFor(() => render(ui));
        expect(screen.getAllByRole('button')).toHaveLength(instanceList.length);
        instanceList.forEach((item) => {
            expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
        });
    }));
    it('should render azure option', () => __awaiter(void 0, void 0, void 0, function* () {
        const ui = withStore(React.createElement(AddInstance, { showAzure: true, onSelectInstanceType: () => { }, selectedInstanceType: selectedInstanceType }));
        yield waitFor(() => render(ui));
        expect(screen.getAllByRole('button')).toHaveLength(instanceList.length + 1);
        instanceList.forEach((item) => {
            expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
        });
        expect(screen.getByTestId('azure-instance')).toBeInTheDocument();
    }));
    it('should invoke a callback with a proper instance type', () => __awaiter(void 0, void 0, void 0, function* () {
        const onSelectInstanceType = jest.fn();
        const ui = withStore(React.createElement(AddInstance, { showAzure: true, onSelectInstanceType: onSelectInstanceType, selectedInstanceType: selectedInstanceType }));
        render(ui);
        expect(onSelectInstanceType).toBeCalledTimes(0);
        const button = (yield screen.findByTestId('rds-instance')).querySelector('button');
        fireEvent.click(button);
        expect(onSelectInstanceType).toBeCalledTimes(1);
        expect(onSelectInstanceType.mock.calls[0][0]).toStrictEqual({ type: 'rds' });
    }));
});
const withStore = (el) => (React.createElement(Provider, { store: configureStore({}) }, el));
//# sourceMappingURL=AddInstance.test.js.map