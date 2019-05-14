import _ from 'lodash';
import { assignModelProperties, variableTypes } from './variable';
var AdhocVariable = /** @class */ (function () {
    /** @ngInject */
    function AdhocVariable(model) {
        this.model = model;
        this.defaults = {
            type: 'adhoc',
            name: '',
            label: '',
            hide: 0,
            datasource: null,
            filters: [],
            skipUrlSync: false,
        };
        assignModelProperties(this, model, this.defaults);
    }
    AdhocVariable.prototype.setValue = function (option) {
        return Promise.resolve();
    };
    AdhocVariable.prototype.getSaveModel = function () {
        assignModelProperties(this.model, this, this.defaults);
        return this.model;
    };
    AdhocVariable.prototype.updateOptions = function () {
        return Promise.resolve();
    };
    AdhocVariable.prototype.dependsOn = function (variable) {
        return false;
    };
    AdhocVariable.prototype.setValueFromUrl = function (urlValue) {
        var _this = this;
        if (!_.isArray(urlValue)) {
            urlValue = [urlValue];
        }
        this.filters = urlValue.map(function (item) {
            var values = item.split('|').map(function (value) {
                return _this.unescapeDelimiter(value);
            });
            return {
                key: values[0],
                operator: values[1],
                value: values[2],
            };
        });
        return Promise.resolve();
    };
    AdhocVariable.prototype.getValueForUrl = function () {
        var _this = this;
        return this.filters.map(function (filter) {
            return [filter.key, filter.operator, filter.value]
                .map(function (value) {
                return _this.escapeDelimiter(value);
            })
                .join('|');
        });
    };
    AdhocVariable.prototype.escapeDelimiter = function (value) {
        return value.replace(/\|/g, '__gfp__');
    };
    AdhocVariable.prototype.unescapeDelimiter = function (value) {
        return value.replace(/__gfp__/g, '|');
    };
    AdhocVariable.prototype.setFilters = function (filters) {
        this.filters = filters;
    };
    return AdhocVariable;
}());
export { AdhocVariable };
variableTypes['adhoc'] = {
    name: 'Ad hoc filters',
    ctor: AdhocVariable,
    description: 'Add key/value filters on the fly',
};
//# sourceMappingURL=adhoc_variable.js.map