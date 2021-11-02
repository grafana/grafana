import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { InlineField, Select } from '@grafana/ui';
import { Resample } from './components/Resample';
import { Reduce } from './components/Reduce';
import { Math } from './components/Math';
import { ClassicConditions } from './components/ClassicConditions';
import { getDefaults } from './utils/expressionTypes';
import { ExpressionQueryType, gelTypes } from './types';
var labelWidth = 14;
var ExpressionQueryEditor = /** @class */ (function (_super) {
    __extends(ExpressionQueryEditor, _super);
    function ExpressionQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSelectExpressionType = function (item) {
            var _a = _this.props, query = _a.query, onChange = _a.onChange;
            onChange(getDefaults(__assign(__assign({}, query), { type: item.value })));
        };
        return _this;
    }
    ExpressionQueryEditor.prototype.renderExpressionType = function () {
        var _a = this.props, onChange = _a.onChange, query = _a.query, queries = _a.queries;
        var refIds = queries.filter(function (q) { return query.refId !== q.refId; }).map(function (q) { return ({ value: q.refId, label: q.refId }); });
        switch (query.type) {
            case ExpressionQueryType.math:
                return React.createElement(Math, { onChange: onChange, query: query, labelWidth: labelWidth });
            case ExpressionQueryType.reduce:
                return React.createElement(Reduce, { refIds: refIds, onChange: onChange, labelWidth: labelWidth, query: query });
            case ExpressionQueryType.resample:
                return React.createElement(Resample, { query: query, labelWidth: labelWidth, onChange: onChange, refIds: refIds });
            case ExpressionQueryType.classic:
                return React.createElement(ClassicConditions, { onChange: onChange, query: query, refIds: refIds });
        }
    };
    ExpressionQueryEditor.prototype.render = function () {
        var query = this.props.query;
        var selected = gelTypes.find(function (o) { return o.value === query.type; });
        return (React.createElement("div", null,
            React.createElement(InlineField, { label: "Operation", labelWidth: labelWidth },
                React.createElement(Select, { menuShouldPortal: true, options: gelTypes, value: selected, onChange: this.onSelectExpressionType, width: 25 })),
            this.renderExpressionType()));
    };
    return ExpressionQueryEditor;
}(PureComponent));
export { ExpressionQueryEditor };
//# sourceMappingURL=ExpressionQueryEditor.js.map