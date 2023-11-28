import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { setDataSourceSrv } from '@grafana/runtime';
import { DerivedField } from './DerivedField';
const mockList = jest.fn();
const validateMock = jest.fn();
describe('DerivedField', () => {
    beforeEach(() => {
        setDataSourceSrv({
            get: jest.fn(),
            reload: jest.fn(),
            getInstanceSettings: jest.fn(),
            getList: mockList.mockImplementation(() => [
                {
                    id: 1,
                    uid: 'metrics',
                    name: 'metrics_ds',
                    meta: {
                        tracing: false,
                        info: {
                            logos: {
                                small: '',
                            },
                        },
                    },
                },
                {
                    id: 2,
                    uid: 'tracing',
                    name: 'tracing_ds',
                    meta: {
                        tracing: true,
                        info: {
                            logos: {
                                small: '',
                            },
                        },
                    },
                },
            ]),
        });
    });
    it('shows internal link if uid is set', () => __awaiter(void 0, void 0, void 0, function* () {
        const value = {
            matcherRegex: '',
            name: '',
            datasourceUid: 'test',
        };
        // Render and wait for the Name field to be visible
        // using findBy to wait for asynchronous operations to complete
        render(React.createElement(DerivedField, { validateName: validateMock, value: value, onChange: () => { }, onDelete: () => { }, suggestions: [] }));
        expect(yield screen.findByText('Name')).toBeInTheDocument();
        expect(screen.getByTestId(selectors.components.DataSourcePicker.container)).toBeInTheDocument();
    }));
    it('shows url link if uid is not set', () => __awaiter(void 0, void 0, void 0, function* () {
        const value = {
            matcherRegex: '',
            name: '',
            url: 'test',
        };
        // Render and wait for the Name field to be visible
        // using findBy to wait for asynchronous operations to complete
        render(React.createElement(DerivedField, { validateName: validateMock, value: value, onChange: () => { }, onDelete: () => { }, suggestions: [] }));
        expect(yield screen.findByText('Name')).toBeInTheDocument();
        expect(yield screen.queryByTestId(selectors.components.DataSourcePicker.container)).not.toBeInTheDocument();
    }));
    it('shows only tracing datasources for internal link', () => __awaiter(void 0, void 0, void 0, function* () {
        const value = {
            matcherRegex: '',
            name: '',
            datasourceUid: 'test',
        };
        // Render and wait for the Name field to be visible
        // using findBy to wait for asynchronous operations to complete
        render(React.createElement(DerivedField, { validateName: validateMock, value: value, onChange: () => { }, onDelete: () => { }, suggestions: [] }));
        expect(yield screen.findByText('Name')).toBeInTheDocument();
        expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
            tracing: true,
        }));
    }));
    it('validates the field name', () => __awaiter(void 0, void 0, void 0, function* () {
        const value = {
            matcherRegex: '',
            name: 'field-name',
            datasourceUid: 'test',
        };
        const validate = jest.fn().mockReturnValue(false);
        render(React.createElement(DerivedField, { validateName: validate, value: value, onChange: () => { }, onDelete: () => { }, suggestions: [] }));
        userEvent.click(yield screen.findByDisplayValue(value.name));
        expect(yield screen.findByText('The name is already in use')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=DerivedField.test.js.map