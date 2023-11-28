import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VariableSupportType } from '@grafana/data';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { NEW_VARIABLE_ID } from '../constants';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { QueryVariableEditorUnConnected } from './QueryVariableEditor';
import { initialQueryVariableModelState } from './reducer';
const setupTestContext = (options) => {
    const variableDefaults = { rootStateKey: 'key' };
    const extended = {
        VariableQueryEditor: LegacyVariableQueryEditor,
        dataSource: {},
    };
    const defaults = {
        variable: Object.assign(Object.assign({}, initialQueryVariableModelState), variableDefaults),
        initQueryVariableEditor: jest.fn(),
        changeQueryVariableDataSource: jest.fn(),
        changeQueryVariableQuery: jest.fn(),
        changeVariableMultiValue: jest.fn(),
        extended,
        onPropChange: jest.fn(),
    };
    const props = Object.assign(Object.assign({}, defaults), options);
    const { rerender } = render(React.createElement(QueryVariableEditorUnConnected, Object.assign({}, props)));
    return { rerender, props };
};
const mockDS = mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            get: () => Promise.resolve(mockDS),
            getList: () => [mockDS],
            getInstanceSettings: () => mockDS,
        }),
    };
});
const defaultIdentifier = { type: 'query', rootStateKey: 'key', id: NEW_VARIABLE_ID };
describe('QueryVariableEditor', () => {
    describe('when the component is mounted', () => {
        it('then it should call initQueryVariableEditor', () => {
            const { props } = setupTestContext({});
            expect(props.initQueryVariableEditor).toHaveBeenCalledTimes(1);
            expect(props.initQueryVariableEditor).toHaveBeenCalledWith(defaultIdentifier);
        });
    });
    describe('when the editor is rendered', () => {
        const extendedCustom = {
            extended: {
                VariableQueryEditor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
                dataSource: {
                    variables: {
                        getType: () => VariableSupportType.Custom,
                        query: jest.fn(),
                        editor: jest.fn(),
                    },
                },
            },
        };
        it('should pass down the query with default values if the datasource config defines it', () => {
            var _a, _b, _c, _d, _e, _f, _g;
            const extended = Object.assign({}, extendedCustom);
            extended.extended.dataSource.variables.getDefaultQuery = jest
                .fn()
                .mockImplementation(() => 'some default query');
            const { props } = setupTestContext(extended);
            expect((_c = (_b = (_a = props.extended) === null || _a === void 0 ? void 0 : _a.dataSource) === null || _b === void 0 ? void 0 : _b.variables) === null || _c === void 0 ? void 0 : _c.getDefaultQuery).toBeDefined();
            expect((_f = (_e = (_d = props.extended) === null || _d === void 0 ? void 0 : _d.dataSource) === null || _e === void 0 ? void 0 : _e.variables) === null || _f === void 0 ? void 0 : _f.getDefaultQuery).toHaveBeenCalledTimes(1);
            expect((_g = props.extended) === null || _g === void 0 ? void 0 : _g.VariableQueryEditor).toHaveBeenCalledWith(expect.objectContaining({ query: 'some default query' }), expect.anything());
        });
        it('should not pass down a default query if the datasource config doesnt define it', () => {
            var _a, _b, _c, _d;
            extendedCustom.extended.dataSource.variables.getDefaultQuery = undefined;
            const { props } = setupTestContext(extendedCustom);
            expect((_c = (_b = (_a = props.extended) === null || _a === void 0 ? void 0 : _a.dataSource) === null || _b === void 0 ? void 0 : _b.variables) === null || _c === void 0 ? void 0 : _c.getDefaultQuery).not.toBeDefined();
            expect((_d = props.extended) === null || _d === void 0 ? void 0 : _d.VariableQueryEditor).toHaveBeenCalledWith(expect.objectContaining({ query: '' }), expect.anything());
        });
    });
    describe('when the user changes', () => {
        it.each `
      fieldName  | propName                      | expectedArgs
      ${'query'} | ${'changeQueryVariableQuery'} | ${[defaultIdentifier, 't', 't']}
      ${'regex'} | ${'onPropChange'}             | ${[{ propName: 'regex', propValue: 't', updateOptions: true }]}
    `('$fieldName field and tabs away then $propName should be called with correct args', ({ fieldName, propName, expectedArgs }) => __awaiter(void 0, void 0, void 0, function* () {
            const { props } = setupTestContext({});
            const propUnderTest = props[propName];
            const fieldAccessor = fieldAccessors[fieldName];
            yield userEvent.type(fieldAccessor(), 't');
            yield userEvent.tab();
            expect(propUnderTest).toHaveBeenCalledTimes(1);
            expect(propUnderTest).toHaveBeenCalledWith(...expectedArgs);
        }));
    });
    describe('when the user changes', () => {
        it.each `
      fieldName  | propName
      ${'query'} | ${'changeQueryVariableQuery'}
      ${'regex'} | ${'onPropChange'}
    `('$fieldName field but reverts the change and tabs away then $propName should not be called', ({ fieldName, propName }) => __awaiter(void 0, void 0, void 0, function* () {
            const { props } = setupTestContext({});
            const propUnderTest = props[propName];
            const fieldAccessor = fieldAccessors[fieldName];
            yield userEvent.type(fieldAccessor(), 't');
            yield userEvent.type(fieldAccessor(), '{backspace}');
            yield userEvent.tab();
            expect(propUnderTest).not.toHaveBeenCalled();
        }));
    });
});
const getQueryField = () => screen.getByRole('textbox', { name: /variable editor form default variable query editor textarea/i });
const getRegExField = () => screen.getByLabelText(/Regex/);
const fieldAccessors = {
    query: getQueryField,
    regex: getRegExField,
};
//# sourceMappingURL=QueryVariableEditor.test.js.map