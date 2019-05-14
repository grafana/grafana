import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { Select } from '@grafana/ui';
var DataSourcePicker = /** @class */ (function (_super) {
    tslib_1.__extends(DataSourcePicker, _super);
    function DataSourcePicker(props) {
        var _this = _super.call(this, props) || this;
        _this.onChange = function (item) {
            var ds = _this.props.datasources.find(function (ds) { return ds.name === item.value; });
            _this.props.onChange(ds);
        };
        return _this;
    }
    DataSourcePicker.prototype.render = function () {
        var _a = this.props, datasources = _a.datasources, current = _a.current, autoFocus = _a.autoFocus, onBlur = _a.onBlur;
        var options = datasources.map(function (ds) { return ({
            value: ds.name,
            label: ds.name,
            imgUrl: ds.meta.info.logos.small,
        }); });
        var value = current && {
            label: current.name,
            value: current.name,
            imgUrl: current.meta.info.logos.small,
        };
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement(Select, { className: "ds-picker", isMulti: false, isClearable: false, backspaceRemovesValue: false, onChange: this.onChange, options: options, autoFocus: autoFocus, onBlur: onBlur, openMenuOnFocus: true, maxMenuHeight: 500, placeholder: "Select datasource", noOptionsMessage: function () { return 'No datasources found'; }, value: value })));
    };
    DataSourcePicker.defaultProps = {
        autoFocus: false,
    };
    return DataSourcePicker;
}(PureComponent));
export { DataSourcePicker };
export default DataSourcePicker;
//# sourceMappingURL=DataSourcePicker.js.map