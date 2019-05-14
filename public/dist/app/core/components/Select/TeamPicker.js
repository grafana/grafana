import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import _ from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
var TeamPicker = /** @class */ (function (_super) {
    tslib_1.__extends(TeamPicker, _super);
    function TeamPicker(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { isLoading: false };
        _this.search = _this.search.bind(_this);
        _this.debouncedSearch = debounce(_this.search, 300, {
            leading: true,
            trailing: true,
        });
        return _this;
    }
    TeamPicker.prototype.search = function (query) {
        var _this = this;
        var backendSrv = getBackendSrv();
        this.setState({ isLoading: true });
        if (_.isNil(query)) {
            query = '';
        }
        return backendSrv.get("/api/teams/search?perpage=10&page=1&query=" + query).then(function (result) {
            var teams = result.teams.map(function (team) {
                return {
                    id: team.id,
                    value: team.id,
                    label: team.name,
                    name: team.name,
                    imgUrl: team.avatarUrl,
                };
            });
            _this.setState({ isLoading: false });
            return teams;
        });
    };
    TeamPicker.prototype.render = function () {
        var _a = this.props, onSelected = _a.onSelected, className = _a.className;
        var isLoading = this.state.isLoading;
        return (React.createElement("div", { className: "user-picker" },
            React.createElement(AsyncSelect, { isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, className: className, placeholder: "Select a team", noOptionsMessage: function () { return 'No teams found'; } })));
    };
    return TeamPicker;
}(Component));
export { TeamPicker };
//# sourceMappingURL=TeamPicker.js.map