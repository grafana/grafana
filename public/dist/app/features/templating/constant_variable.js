import { assignModelProperties, variableTypes } from './variable';
var ConstantVariable = /** @class */ (function () {
    /** @ngInject */
    function ConstantVariable(model, variableSrv) {
        this.model = model;
        this.variableSrv = variableSrv;
        this.defaults = {
            type: 'constant',
            name: '',
            hide: 2,
            label: '',
            query: '',
            current: {},
            options: [],
            skipUrlSync: false,
        };
        assignModelProperties(this, model, this.defaults);
    }
    ConstantVariable.prototype.getSaveModel = function () {
        assignModelProperties(this.model, this, this.defaults);
        return this.model;
    };
    ConstantVariable.prototype.setValue = function (option) {
        this.variableSrv.setOptionAsCurrent(this, option);
    };
    ConstantVariable.prototype.updateOptions = function () {
        this.options = [{ text: this.query.trim(), value: this.query.trim() }];
        this.setValue(this.options[0]);
        return Promise.resolve();
    };
    ConstantVariable.prototype.dependsOn = function (variable) {
        return false;
    };
    ConstantVariable.prototype.setValueFromUrl = function (urlValue) {
        return this.variableSrv.setOptionFromUrl(this, urlValue);
    };
    ConstantVariable.prototype.getValueForUrl = function () {
        return this.current.value;
    };
    return ConstantVariable;
}());
export { ConstantVariable };
variableTypes['constant'] = {
    name: 'Constant',
    ctor: ConstantVariable,
    description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
};
//# sourceMappingURL=constant_variable.js.map