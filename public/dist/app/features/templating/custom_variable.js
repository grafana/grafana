import _ from 'lodash';
import { assignModelProperties, variableTypes } from './variable';
var CustomVariable = /** @class */ (function () {
    /** @ngInject */
    function CustomVariable(model, variableSrv) {
        this.model = model;
        this.variableSrv = variableSrv;
        this.defaults = {
            type: 'custom',
            name: '',
            label: '',
            hide: 0,
            options: [],
            current: {},
            query: '',
            includeAll: false,
            multi: false,
            allValue: null,
            skipUrlSync: false,
        };
        assignModelProperties(this, model, this.defaults);
    }
    CustomVariable.prototype.setValue = function (option) {
        return this.variableSrv.setOptionAsCurrent(this, option);
    };
    CustomVariable.prototype.getSaveModel = function () {
        assignModelProperties(this.model, this, this.defaults);
        return this.model;
    };
    CustomVariable.prototype.updateOptions = function () {
        // extract options in comma separated string (use backslash to escape wanted commas)
        this.options = _.map(this.query.match(/(?:\\,|[^,])+/g), function (text) {
            text = text.replace(/\\,/g, ',');
            return { text: text.trim(), value: text.trim() };
        });
        if (this.includeAll) {
            this.addAllOption();
        }
        return this.variableSrv.validateVariableSelectionState(this);
    };
    CustomVariable.prototype.addAllOption = function () {
        this.options.unshift({ text: 'All', value: '$__all' });
    };
    CustomVariable.prototype.dependsOn = function (variable) {
        return false;
    };
    CustomVariable.prototype.setValueFromUrl = function (urlValue) {
        return this.variableSrv.setOptionFromUrl(this, urlValue);
    };
    CustomVariable.prototype.getValueForUrl = function () {
        if (this.current.text === 'All') {
            return 'All';
        }
        return this.current.value;
    };
    return CustomVariable;
}());
export { CustomVariable };
variableTypes['custom'] = {
    name: 'Custom',
    ctor: CustomVariable,
    description: 'Define variable values manually',
    supportsMulti: true,
};
//# sourceMappingURL=custom_variable.js.map