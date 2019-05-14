import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var VizPickerSearch = /** @class */ (function (_super) {
    tslib_1.__extends(VizPickerSearch, _super);
    function VizPickerSearch() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    VizPickerSearch.prototype.render = function () {
        var _a = this.props, searchQuery = _a.searchQuery, onChange = _a.onChange, onClose = _a.onClose;
        return (React.createElement(React.Fragment, null,
            React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon", inputClassName: "gf-form-input width-13", placeholder: "", onChange: onChange, value: searchQuery, ref: function (element) { return element && element.focus(); } }),
            React.createElement("button", { className: "btn btn-link toolbar__close", onClick: onClose },
                React.createElement("i", { className: "fa fa-chevron-up" }))));
    };
    return VizPickerSearch;
}(PureComponent));
export { VizPickerSearch };
//# sourceMappingURL=VizPickerSearch.js.map