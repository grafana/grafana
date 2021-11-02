import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryVariableEditorUnConnected } from './QueryVariableEditor';
import { initialQueryVariableModelState } from './reducer';
import { initialVariableEditorState } from '../editor/reducer';
import { describe, expect } from '../../../../test/lib/common';
import { NEW_VARIABLE_ID } from '../state/types';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
var setupTestContext = function (options) {
    var defaults = {
        variable: __assign({}, initialQueryVariableModelState),
        initQueryVariableEditor: jest.fn(),
        changeQueryVariableDataSource: jest.fn(),
        changeQueryVariableQuery: jest.fn(),
        changeVariableMultiValue: jest.fn(),
        editor: __assign(__assign({}, initialVariableEditorState), { extended: {
                VariableQueryEditor: LegacyVariableQueryEditor,
                dataSource: {},
            } }),
        onPropChange: jest.fn(),
    };
    var props = __assign(__assign({}, defaults), options);
    var rerender = render(React.createElement(QueryVariableEditorUnConnected, __assign({}, props))).rerender;
    return { rerender: rerender, props: props };
};
var mockDS = mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', function () {
    return {
        getDataSourceSrv: function () { return ({
            get: function () { return Promise.resolve(mockDS); },
            getList: function () { return [mockDS]; },
            getInstanceSettings: function () { return mockDS; },
        }); },
    };
});
describe('QueryVariableEditor', function () {
    describe('when the component is mounted', function () {
        it('then it should call initQueryVariableEditor', function () {
            var props = setupTestContext({}).props;
            expect(props.initQueryVariableEditor).toHaveBeenCalledTimes(1);
            expect(props.initQueryVariableEditor).toHaveBeenCalledWith({ type: 'query', id: NEW_VARIABLE_ID });
        });
    });
    describe('when the user changes', function () {
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      fieldName  | propName                      | expectedArgs\n      ", " | ", " | ", "\n      ", " | ", "             | ", "\n    "], ["\n      fieldName  | propName                      | expectedArgs\n      ", " | ", " | ", "\n      ", " | ", "             | ", "\n    "])), 'query', 'changeQueryVariableQuery', [{ type: 'query', id: NEW_VARIABLE_ID }, 't', 't'], 'regex', 'onPropChange', [{ propName: 'regex', propValue: 't', updateOptions: true }])('$fieldName field and tabs away then $propName should be called with correct args', function (_a) {
            var _b;
            var fieldName = _a.fieldName, propName = _a.propName, expectedArgs = _a.expectedArgs;
            var props = setupTestContext({}).props;
            var propUnderTest = props[propName];
            var fieldAccessor = fieldAccessors[fieldName];
            userEvent.type(fieldAccessor(), 't');
            userEvent.tab();
            expect(propUnderTest).toHaveBeenCalledTimes(1);
            (_b = expect(propUnderTest)).toHaveBeenCalledWith.apply(_b, __spreadArray([], __read(expectedArgs), false));
        });
    });
    describe('when the user changes', function () {
        it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      fieldName  | propName\n      ", " | ", "\n      ", " | ", "\n    "], ["\n      fieldName  | propName\n      ", " | ", "\n      ", " | ", "\n    "])), 'query', 'changeQueryVariableQuery', 'regex', 'onPropChange')('$fieldName field but reverts the change and tabs away then $propName should not be called', function (_a) {
            var fieldName = _a.fieldName, propName = _a.propName;
            var props = setupTestContext({}).props;
            var propUnderTest = props[propName];
            var fieldAccessor = fieldAccessors[fieldName];
            userEvent.type(fieldAccessor(), 't');
            userEvent.type(fieldAccessor(), '{backspace}');
            userEvent.tab();
            expect(propUnderTest).not.toHaveBeenCalled();
        });
    });
});
var getQueryField = function () {
    return screen.getByRole('textbox', { name: /variable editor form default variable query editor textarea/i });
};
var getRegExField = function () { return screen.getByRole('textbox', { name: /variable editor form query regex field/i }); };
var fieldAccessors = {
    query: getQueryField,
    regex: getRegExField,
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=QueryVariableEditor.test.js.map