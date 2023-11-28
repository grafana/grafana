import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Databases } from 'app/percona/shared/core';
import { AdditionalOptionsFormPart, getAdditionalOptions } from './AdditionalOptions/AdditionalOptions';
import { ExternalServiceConnectionDetails } from './ExternalServiceConnectionDetails/ExternalServiceConnectionDetails';
import { trackingOptions, rdsTrackingOptions } from './FormParts.constants';
import { LabelsFormPart } from './Labels/Labels';
import { MainDetailsFormPart } from './MainDetails/MainDetails';
const form = {
    change: jest.fn(),
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    getState: () => ({}),
};
describe('MainDetailsFormPart ::', () => {
    it('should disable fields with sat isRDS flag', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => React.createElement(MainDetailsFormPart, { form: form, remoteInstanceCredentials: { isRDS: true } }) }));
        const fields = container.querySelectorAll('input');
        expect(fields.length).toBe(5);
        expect(screen.getByTestId('address-text-input')).toBeDisabled();
        expect(screen.getByTestId('serviceName-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('port-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('username-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('password-password-input')).not.toBeDisabled();
    }));
    it('should disable fields with not sat isRDS flag', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => React.createElement(MainDetailsFormPart, { form: form, remoteInstanceCredentials: { isRDS: false } }) }));
        const fields = container.querySelectorAll('input');
        expect(fields.length).toBe(5);
        expect(screen.getByTestId('address-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('serviceName-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('port-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('username-text-input')).not.toBeDisabled();
        expect(screen.getByTestId('password-password-input')).not.toBeDisabled();
    }));
});
describe('ExternalServiceConnectionDetails ::', () => {
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(ExternalServiceConnectionDetails, { form: form }) }));
        const fields = container.querySelectorAll('input');
        expect(fields.length).toBe(5);
    }));
});
describe('LabelsFormPart ::', () => {
    it('should render correct fields with empty props', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(LabelsFormPart, null) }));
        const fields = container.querySelectorAll('input');
        const textArea = container.querySelectorAll('textarea');
        expect(fields.length).toBe(5);
        expect(textArea.length).toBe(1);
    }));
});
describe('AdditionalOptionsFormPart ::', () => {
    it('should render correct for PostgreSQL instance', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.postgresql;
        const remoteInstanceCredentials = {
            isRDS: false,
        };
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => (React.createElement(AdditionalOptionsFormPart, { instanceType: type, remoteInstanceCredentials: remoteInstanceCredentials, loading: false, form: form })) }));
        expect(screen.getByTestId('skip_connection_check-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('tls-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('tls_skip_verify-checkbox-input')).toBeInTheDocument();
    }));
});
describe('getAdditionalOptions ::', () => {
    it('should render correct for MongoDB', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.mongodb;
        const remoteInstanceCredentials = {
            isRDS: false,
        };
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => getAdditionalOptions(type, remoteInstanceCredentials, form) }));
        const fields = container.querySelectorAll('input');
        expect(screen.getByTestId('tls-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('tls_skip_verify-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('qan_mongodb_profiler-checkbox-input')).toBeInTheDocument();
        expect(fields.length).toBe(3);
    }));
    it('should render correct for MySQL', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.mysql;
        const remoteInstanceCredentials = {
            isRDS: false,
        };
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => getAdditionalOptions(type, remoteInstanceCredentials, form) }));
        const fields = container.querySelectorAll('input');
        expect(screen.getByTestId('qan_mysql_perfschema-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('disable_comments_parsing-checkbox-input')).toBeInTheDocument();
        expect(fields.length).toBe(9);
    }));
    it('should render correct for RDS MySQL', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.mysql;
        const remoteInstanceCredentials = {
            isRDS: true,
        };
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => getAdditionalOptions(type, remoteInstanceCredentials, form) }));
        const fields = container.querySelectorAll('input');
        expect(screen.getByTestId('qan_mysql_perfschema-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('disable_comments_parsing-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('disable_basic_metrics-checkbox-input')).toBeInTheDocument();
        expect(screen.getByTestId('disable_enhanced_metrics-checkbox-input')).toBeInTheDocument();
        expect(fields.length).toBe(11);
    }));
    it('should render correct for PostgreSQL', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.postgresql;
        const remoteInstanceCredentials = {
            isRDS: false,
        };
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => getAdditionalOptions(type, remoteInstanceCredentials, form) }));
        const fields = container.querySelectorAll('input');
        const trakingFields = screen.getAllByTestId('tracking-radio-button');
        expect(trakingFields.length).toBe(trackingOptions.length);
        expect(fields.length).toBe(7);
    }));
    it('should render correct for RDS PostgreSQL', () => __awaiter(void 0, void 0, void 0, function* () {
        const type = Databases.postgresql;
        const remoteInstanceCredentials = {
            isRDS: true,
        };
        const { container } = render(React.createElement(Form, { onSubmit: jest.fn(), render: () => getAdditionalOptions(type, remoteInstanceCredentials, form) }));
        const fields = container.querySelectorAll('input');
        const trakingFields = screen.getAllByTestId('tracking-radio-button');
        expect(trakingFields.length).toBe(rdsTrackingOptions.length);
        expect(fields.length).toBe(8);
    }));
});
//# sourceMappingURL=FormParts.test.js.map