import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { ExploreId } from 'app/types/explore';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { lastSavedUrl, resetExploreAction, richHistoryUpdatedAction } from './state/main';
import { getRichHistory } from '../../core/utils/richHistory';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { Branding } from '../../core/components/Branding/Branding';
import { getNavModel } from '../../core/selectors/navModel';
var mapStateToProps = function (state) {
    return {
        navModel: getNavModel(state.navIndex, 'explore'),
        exploreState: state.explore,
    };
};
var mapDispatchToProps = {
    resetExploreAction: resetExploreAction,
    richHistoryUpdatedAction: richHistoryUpdatedAction,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var WrapperUnconnected = /** @class */ (function (_super) {
    __extends(WrapperUnconnected, _super);
    function WrapperUnconnected() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    WrapperUnconnected.prototype.componentWillUnmount = function () {
        this.props.resetExploreAction({});
    };
    WrapperUnconnected.prototype.componentDidMount = function () {
        lastSavedUrl.left = undefined;
        lastSavedUrl.right = undefined;
        var richHistory = getRichHistory();
        this.props.richHistoryUpdatedAction({ richHistory: richHistory });
    };
    WrapperUnconnected.prototype.componentDidUpdate = function (prevProps) {
        var _a, _b, _c, _d;
        var _e = this.props.queryParams, left = _e.left, right = _e.right;
        var hasSplit = Boolean(left) && Boolean(right);
        var datasourceTitle = hasSplit
            ? ((_a = this.props.exploreState.left.datasourceInstance) === null || _a === void 0 ? void 0 : _a.name) + " | " + ((_c = (_b = this.props.exploreState.right) === null || _b === void 0 ? void 0 : _b.datasourceInstance) === null || _c === void 0 ? void 0 : _c.name)
            : "" + ((_d = this.props.exploreState.left.datasourceInstance) === null || _d === void 0 ? void 0 : _d.name);
        var documentTitle = this.props.navModel.main.text + " - " + datasourceTitle + " - " + Branding.AppTitle;
        document.title = documentTitle;
    };
    WrapperUnconnected.prototype.render = function () {
        var _a = this.props.queryParams, left = _a.left, right = _a.right;
        var hasSplit = Boolean(left) && Boolean(right);
        return (React.createElement("div", { className: "page-scrollbar-wrapper" },
            React.createElement("div", { className: "explore-wrapper" },
                React.createElement(ErrorBoundaryAlert, { style: "page" },
                    React.createElement(ExplorePaneContainer, { split: hasSplit, exploreId: ExploreId.left, urlQuery: left })),
                hasSplit && (React.createElement(ErrorBoundaryAlert, { style: "page" },
                    React.createElement(ExplorePaneContainer, { split: hasSplit, exploreId: ExploreId.right, urlQuery: right }))))));
    };
    return WrapperUnconnected;
}(PureComponent));
var Wrapper = connector(WrapperUnconnected);
export default Wrapper;
//# sourceMappingURL=Wrapper.js.map