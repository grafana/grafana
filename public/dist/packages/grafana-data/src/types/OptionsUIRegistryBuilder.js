import { Registry } from '../utils/Registry';
var OptionsUIRegistryBuilder = /** @class */ (function () {
    function OptionsUIRegistryBuilder() {
        this.properties = [];
    }
    OptionsUIRegistryBuilder.prototype.addCustomEditor = function (config) {
        this.properties.push(config);
        return this;
    };
    OptionsUIRegistryBuilder.prototype.getRegistry = function () {
        var _this = this;
        return new Registry(function () {
            return _this.properties;
        });
    };
    OptionsUIRegistryBuilder.prototype.getItems = function () {
        return this.properties;
    };
    return OptionsUIRegistryBuilder;
}());
export { OptionsUIRegistryBuilder };
//# sourceMappingURL=OptionsUIRegistryBuilder.js.map