import { __extends } from "tslib";
import React, { Component } from 'react';
import { debounce, isNil } from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
var TeamPicker = /** @class */ (function (_super) {
    __extends(TeamPicker, _super);
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
        this.setState({ isLoading: true });
        if (isNil(query)) {
            query = '';
        }
        return getBackendSrv()
            .get("/api/teams/search?perpage=100&page=1&query=" + query)
            .then(function (result) {
            var teams = result.teams.map(function (team) {
                return {
                    value: team,
                    label: team.name,
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
        return (React.createElement("div", { className: "user-picker", "data-testid": "teamPicker" },
            React.createElement(AsyncSelect, { menuShouldPortal: true, isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, className: className, placeholder: "Select a team", noOptionsMessage: "No teams found", "aria-label": "Team picker" })));
    };
    return TeamPicker;
}(Component));
export { TeamPicker };
//# sourceMappingURL=TeamPicker.js.map