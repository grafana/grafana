import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { changeDatasource, clearQueries, splitClose, runQueries, splitOpen } from './state/actions';
import TimePicker from './TimePicker';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';
var IconSide;
(function (IconSide) {
    IconSide["left"] = "left";
    IconSide["right"] = "right";
})(IconSide || (IconSide = {}));
var createResponsiveButton = function (options) {
    var defaultOptions = {
        iconSide: IconSide.left,
    };
    var props = tslib_1.__assign({}, options, { defaultOptions: defaultOptions });
    var title = props.title, onClick = props.onClick, buttonClassName = props.buttonClassName, iconClassName = props.iconClassName, splitted = props.splitted, iconSide = props.iconSide;
    return (React.createElement("button", { className: "btn navbar-button " + (buttonClassName ? buttonClassName : ''), onClick: onClick },
        iconClassName && iconSide === IconSide.left ? React.createElement("i", { className: iconClassName + " icon-margin-right" }) : null,
        React.createElement("span", { className: "btn-title" }, !splitted ? title : ''),
        iconClassName && iconSide === IconSide.right ? React.createElement("i", { className: iconClassName + " icon-margin-left" }) : null));
};
var UnConnectedExploreToolbar = /** @class */ (function (_super) {
    tslib_1.__extends(UnConnectedExploreToolbar, _super);
    function UnConnectedExploreToolbar(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeDatasource = function (option) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                this.props.changeDatasource(this.props.exploreId, option.value);
                return [2 /*return*/];
            });
        }); };
        _this.onClearAll = function () {
            _this.props.clearAll(_this.props.exploreId);
        };
        _this.onRunQuery = function () {
            _this.props.runQuery(_this.props.exploreId);
        };
        _this.onCloseTimePicker = function () {
            _this.props.timepickerRef.current.setState({ isOpen: false });
        };
        return _this;
    }
    UnConnectedExploreToolbar.prototype.render = function () {
        var _a = this.props, datasourceMissing = _a.datasourceMissing, exploreDatasources = _a.exploreDatasources, exploreId = _a.exploreId, loading = _a.loading, range = _a.range, selectedDatasource = _a.selectedDatasource, splitted = _a.splitted, timepickerRef = _a.timepickerRef;
        return (React.createElement("div", { className: splitted ? 'explore-toolbar splitted' : 'explore-toolbar' },
            React.createElement("div", { className: "explore-toolbar-item" },
                React.createElement("div", { className: "explore-toolbar-header" },
                    React.createElement("div", { className: "explore-toolbar-header-title" }, exploreId === 'left' && (React.createElement("span", { className: "navbar-page-btn" },
                        React.createElement("i", { className: "gicon gicon-explore" }),
                        "Explore"))),
                    exploreId === 'right' && (React.createElement("a", { className: "explore-toolbar-header-close", onClick: this.props.closeSplit },
                        React.createElement("i", { className: "fa fa-times fa-fw" }))))),
            React.createElement("div", { className: "explore-toolbar-item" },
                React.createElement("div", { className: "explore-toolbar-content" },
                    !datasourceMissing ? (React.createElement("div", { className: "explore-toolbar-content-item" },
                        React.createElement("div", { className: "datasource-picker" },
                            React.createElement(DataSourcePicker, { onChange: this.onChangeDatasource, datasources: exploreDatasources, current: selectedDatasource })))) : null,
                    exploreId === 'left' && !splitted ? (React.createElement("div", { className: "explore-toolbar-content-item" }, createResponsiveButton({
                        splitted: splitted,
                        title: 'Split',
                        onClick: this.props.split,
                        iconClassName: 'fa fa-fw fa-columns icon-margin-right',
                        iconSide: IconSide.left,
                    }))) : null,
                    React.createElement("div", { className: "explore-toolbar-content-item timepicker" },
                        React.createElement(ClickOutsideWrapper, { onClick: this.onCloseTimePicker },
                            React.createElement(TimePicker, { ref: timepickerRef, range: range, onChangeTime: this.props.onChangeTime }))),
                    React.createElement("div", { className: "explore-toolbar-content-item" },
                        React.createElement("button", { className: "btn navbar-button navbar-button--no-icon", onClick: this.onClearAll }, "Clear All")),
                    React.createElement("div", { className: "explore-toolbar-content-item" }, createResponsiveButton({
                        splitted: splitted,
                        title: 'Run Query',
                        onClick: this.onRunQuery,
                        buttonClassName: 'navbar-button--secondary',
                        iconClassName: loading ? 'fa fa-spinner fa-fw fa-spin run-icon' : 'fa fa-level-down fa-fw run-icon',
                        iconSide: IconSide.right,
                    }))))));
    };
    return UnConnectedExploreToolbar;
}(PureComponent));
export { UnConnectedExploreToolbar };
var mapStateToProps = function (state, _a) {
    var exploreId = _a.exploreId;
    var splitted = state.explore.split;
    var exploreItem = state.explore[exploreId];
    var datasourceInstance = exploreItem.datasourceInstance, datasourceMissing = exploreItem.datasourceMissing, exploreDatasources = exploreItem.exploreDatasources, queryTransactions = exploreItem.queryTransactions, range = exploreItem.range;
    var selectedDatasource = datasourceInstance
        ? exploreDatasources.find(function (datasource) { return datasource.name === datasourceInstance.name; })
        : undefined;
    var loading = queryTransactions.some(function (qt) { return !qt.done; });
    return {
        datasourceMissing: datasourceMissing,
        exploreDatasources: exploreDatasources,
        loading: loading,
        range: range,
        selectedDatasource: selectedDatasource,
        splitted: splitted,
    };
};
var mapDispatchToProps = {
    changeDatasource: changeDatasource,
    clearAll: clearQueries,
    runQuery: runQueries,
    closeSplit: splitClose,
    split: splitOpen,
};
export var ExploreToolbar = hot(module)(connect(mapStateToProps, mapDispatchToProps)(UnConnectedExploreToolbar));
//# sourceMappingURL=ExploreToolbar.js.map