/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { __awaiter, __rest } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import arrayMutators from 'final-form-arrays';
import React from 'react';
import { Form } from 'react-final-form';
import { dbClustersStub } from '../../__mocks__/dbClustersStubs';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { AdvancedOptionsFields, DBClusterResources } from './DBClusterAdvancedOptions.types';
jest.mock('../../DBCluster.service');
jest.mock('../../PSMDB.service');
jest.mock('../../XtraDB.service');
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('DBClusterAdvancedOptions::', () => {
    it('renders correctly in create mode', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "create", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
        yield waitFor(() => fireEvent.click(advancedOptions));
        expect(yield screen.getByTestId('template-field-container')).toBeInTheDocument();
        expect(yield screen.getByTestId('nodes-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('resources-field-container')).toBeInTheDocument();
        expect(yield screen.getByTestId('memory-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('cpu-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('disk-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('configurations')).toBeInTheDocument();
    }));
    it('renders correctly in edit mode', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "edit", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        expect(yield screen.getByTestId('template-field-container')).toBeInTheDocument();
        expect(yield screen.getByTestId('nodes-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('resources-field-container')).toBeInTheDocument();
        expect(yield screen.getByTestId('memory-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('cpu-number-input')).toBeInTheDocument();
        expect(yield screen.getByTestId('disk-number-input')).toBeInTheDocument();
        expect(screen.getByTestId('dbcluster-resources-bar-memory')).toBeInTheDocument();
        expect(screen.getByTestId('dbcluster-resources-bar-cpu')).toBeInTheDocument();
        expect(yield screen.getByTestId('configurations')).toBeInTheDocument();
    }));
    it('renders correctly with initial values', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), initialValues: { [AdvancedOptionsFields.nodes]: 3 }, mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "create", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
        yield waitFor(() => fireEvent.click(advancedOptions));
        const nodes = screen.getByTestId('nodes-number-input');
        expect(nodes.getAttribute('value')).toBe('3');
    }));
    it('should disable memory, cpu and disk when resources are not custom', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), initialValues: { [AdvancedOptionsFields.resources]: DBClusterResources.small }, mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "create", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
        yield waitFor(() => fireEvent.click(advancedOptions));
        const memory = screen.getByTestId('memory-number-input');
        const cpu = screen.getByTestId('cpu-number-input');
        const disk = screen.getByTestId('disk-number-input');
        expect(memory).toBeDisabled();
        expect(cpu).toBeDisabled();
        expect(disk).toBeDisabled();
    }));
    it('should enable memory and cpu when resources is custom', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), initialValues: {
                [AdvancedOptionsFields.resources]: DBClusterResources.small,
            }, mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "create", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
        yield waitFor(() => fireEvent.click(advancedOptions));
        const resources = screen.getByTestId('resources-field-container').querySelector('input');
        if (resources) {
            yield waitFor(() => fireEvent.change(resources, { target: { value: DBClusterResources.custom } }));
        }
        const memory = screen.getByTestId('memory-number-input');
        const cpu = screen.getByTestId('cpu-number-input');
        const disk = screen.getByTestId('disk-number-input');
        expect(memory).toBeDisabled();
        expect(cpu).toBeDisabled();
        expect(disk).toBeDisabled();
    }));
    it('should not show the arrow button in edit mode ', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        , { 
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            onSubmit: jest.fn(), mutators: Object.assign({}, arrayMutators), render: (_a) => {
                var { form, handleSubmit, valid, pristine } = _a, props = __rest(_a, ["form", "handleSubmit", "valid", "pristine"]);
                return (React.createElement(DBClusterAdvancedOptions, Object.assign({ mode: "edit", showUnsafeConfigurationWarning: true, setShowUnsafeConfigurationWarning: jest.fn(), form: form, selectedCluster: dbClustersStub[0], handleSubmit: handleSubmit, pristine: pristine, valid: valid }, props)));
            } })));
        expect(screen.queryByTestId('dbCluster-advanced-settings')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=DBClusterAdvancedOptions.test.js.map