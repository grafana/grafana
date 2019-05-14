import { assignModelProperties, variableTypes } from './variable';
var TextBoxVariable = /** @class */ (function () {
    /** @ngInject */
    function TextBoxVariable(model, variableSrv) {
        this.model = model;
        this.variableSrv = variableSrv;
        this.defaults = {
            type: 'textbox',
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
    TextBoxVariable.prototype.getSaveModel = function () {
        assignModelProperties(this.model, this, this.defaults);
        return this.model;
    };
    TextBoxVariable.prototype.setValue = function (option) {
        this.variableSrv.setOptionAsCurrent(this, option);
    };
    TextBoxVariable.prototype.updateOptions = function () {
        this.options = [{ text: this.query.trim(), value: this.query.trim() }];
        this.current = this.options[0];
        return Promise.resolve();
    };
    TextBoxVariable.prototype.dependsOn = function (variable) {
        return false;
    };
    TextBoxVariable.prototype.setValueFromUrl = function (urlValue) {
        this.query = urlValue;
        return this.variableSrv.setOptionFromUrl(this, urlValue);
    };
    TextBoxVariable.prototype.getValueForUrl = function () {
        return this.current.value;
    };
    return TextBoxVariable;
}());
export { TextBoxVariable };
variableTypes['textbox'] = {
    name: 'Text box',
    ctor: TextBoxVariable,
    description: 'Define a textbox variable, where users can enter any arbitrary string',
};
//# sourceMappingURL=TextBoxVariable.js.map