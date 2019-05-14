import * as tslib_1 from "tslib";
// Libraries
import React, { Component } from 'react';
import _ from 'lodash';
// Components
import { AsyncSelect } from '@grafana/ui';
// Utils & Services
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
var UserPicker = /** @class */ (function (_super) {
    tslib_1.__extends(UserPicker, _super);
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
        var backendSrv = getBackendSrv();
        this.setState({ isLoading: true });
        if (_.isNil(query)) {
            query = '';
        }
        return backendSrv
            .get("/api/org/users?query=" + query + "&limit=10")
            .then(function (result) {
            return result.map(function (user) { return ({
                id: user.userId,
                value: user.userId,
                label: user.login === user.email ? user.login : user.login + " - " + user.email,
                imgUrl: user.avatarUrl,
                login: user.login,
            }); });
        })
            .finally(function () {
            _this.setState({ isLoading: false });
        });
    };
    UserPicker.prototype.render = function () {
        var _a = this.props, className = _a.className, onSelected = _a.onSelected;
        var isLoading = this.state.isLoading;
        return (React.createElement("div", { className: "user-picker" },
            React.createElement(AsyncSelect, { className: className, isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, placeholder: "Select user", noOptionsMessage: function () { return 'No users found'; } })));
    };
    return UserPicker;
}(Component));
export { UserPicker };
//# sourceMappingURL=UserPicker.js.map