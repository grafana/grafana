import { __extends } from "tslib";
// Libraries
import React, { Component } from 'react';
import { debounce, isNil } from 'lodash';
// Components
import { AsyncSelect } from '@grafana/ui';
// Utils & Services
import { getBackendSrv } from '@grafana/runtime';
var UserPicker = /** @class */ (function (_super) {
    __extends(UserPicker, _super);
    function UserPicker(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { isLoading: false };
        _this.search = _this.search.bind(_this);
        _this.debouncedSearch = debounce(_this.search, 300, {
            leading: true,
            trailing: true,
        });
        return _this;
    }
    UserPicker.prototype.search = function (query) {
        var _this = this;
        this.setState({ isLoading: true });
        if (isNil(query)) {
            query = '';
        }
        return getBackendSrv()
            .get("/api/org/users/lookup?query=" + query + "&limit=100")
            .then(function (result) {
            return result.map(function (user) { return ({
                id: user.userId,
                value: user.userId,
                label: user.login,
                imgUrl: user.avatarUrl,
                login: user.login,
            }); });
        })
            .finally(function () {
            _this.setState({ isLoading: false });
        });
    };
    UserPicker.prototype.render = function () {
        var _a = this.props, className = _a.className, onSelected = _a.onSelected, inputId = _a.inputId;
        var isLoading = this.state.isLoading;
        return (React.createElement("div", { className: "user-picker", "data-testid": "userPicker" },
            React.createElement(AsyncSelect, { menuShouldPortal: true, isClearable: true, className: className, inputId: inputId, isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, placeholder: "Start typing to search for user", noOptionsMessage: "No users found", "aria-label": "User picker" })));
    };
    return UserPicker;
}(Component));
export { UserPicker };
//# sourceMappingURL=UserPicker.js.map