import * as tslib_1 from "tslib";
import KustoQueryField from './KustoQueryField';
import Kusto from './kusto/kusto';
import React, { Component } from 'react';
import coreModule from 'app/core/core_module';
var Editor = /** @class */ (function (_super) {
    tslib_1.__extends(Editor, _super);
    function Editor(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeQuery = function (value) {
            var _a = _this.props, index = _a.index, change = _a.change;
            var query = _this.state.query;
            var edited = query !== value;
            _this.setState({ edited: edited, query: value });
            if (change) {
                change(value, index);
            }
        };
        _this.onPressEnter = function () {
            var execute = _this.props.execute;
            if (execute) {
                execute();
            }
        };
        _this.state = {
            edited: false,
            query: props.query || '',
        };
        return _this;
    }
    Editor.prototype.render = function () {
        var _a = this.props, variables = _a.variables, getSchema = _a.getSchema, placeholder = _a.placeholder;
        var _b = this.state, edited = _b.edited, query = _b.query;
        return (React.createElement("div", { className: "gf-form-input", style: { height: 'auto' } },
            React.createElement(KustoQueryField, { initialQuery: edited ? null : query, onPressEnter: this.onPressEnter, onQueryChange: this.onChangeQuery, prismLanguage: "kusto", prismDefinition: Kusto, placeholder: placeholder, templateVariables: variables, getSchema: getSchema })));
    };
    Editor.defaultProps = {
        placeholder: 'Enter a query',
    };
    return Editor;
}(Component));
coreModule.directive('kustoEditor', [
    'reactDirective',
    function (reactDirective) {
        return reactDirective(Editor, [
            'change',
            'database',
            'execute',
            'query',
            'variables',
            'placeholder',
            ['getSchema', { watchDepth: 'reference' }],
        ]);
    },
]);
//# sourceMappingURL=editor_component.js.map