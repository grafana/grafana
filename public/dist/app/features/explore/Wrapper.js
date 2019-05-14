import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { updateLocation } from 'app/core/actions';
import { ExploreId } from 'app/types/explore';
import { parseUrlState } from 'app/core/utils/explore';
import ErrorBoundary from './ErrorBoundary';
import Explore from './Explore';
import { CustomScrollbar } from '@grafana/ui';
import { initializeExploreSplitAction, resetExploreAction } from './state/actionTypes';
var Wrapper = /** @class */ (function (_super) {
    tslib_1.__extends(Wrapper, _super);
    function Wrapper(props) {
        var _this = _super.call(this, props) || this;
        _this.urlStates = {};
        var _a = props.urlStates, left = _a.left, right = _a.right;
        if (props.urlStates.left) {
            _this.urlStates.leftState = parseUrlState(left);
        }
        if (props.urlStates.right) {
            _this.urlStates.rightState = parseUrlState(right);
            _this.initialSplit = true;
        }
        return _this;
    }
    Wrapper.prototype.componentDidMount = function () {
        if (this.initialSplit) {
            this.props.initializeExploreSplitAction();
        }
    };
    Wrapper.prototype.componentWillUnmount = function () {
        this.props.resetExploreAction();
    };
    Wrapper.prototype.render = function () {
        var split = this.props.split;
        var _a = this.urlStates, leftState = _a.leftState, rightState = _a.rightState;
        return (React.createElement("div", { className: "page-scrollbar-wrapper" },
            React.createElement(CustomScrollbar, { autoHeightMin: '100%', className: "custom-scrollbar--page" },
                React.createElement("div", { className: "explore-wrapper" },
                    React.createElement(ErrorBoundary, null,
                        React.createElement(Explore, { exploreId: ExploreId.left, urlState: leftState })),
                    split && (React.createElement(ErrorBoundary, null,
                        React.createElement(Explore, { exploreId: ExploreId.right, urlState: rightState })))))));
    };
    return Wrapper;
}(Component));
export { Wrapper };
var mapStateToProps = function (state) {
    var urlStates = state.location.query;
    var split = state.explore.split;
    return { split: split, urlStates: urlStates };
};
var mapDispatchToProps = {
    initializeExploreSplitAction: initializeExploreSplitAction,
    updateLocation: updateLocation,
    resetExploreAction: resetExploreAction,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Wrapper));
//# sourceMappingURL=Wrapper.js.map