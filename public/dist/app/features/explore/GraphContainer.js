import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { toggleGraph, changeTime } from './state/actions';
import Graph from './Graph';
import Panel from './Panel';
var GraphContainer = /** @class */ (function (_super) {
    tslib_1.__extends(GraphContainer, _super);
    function GraphContainer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClickGraphButton = function () {
            _this.props.toggleGraph(_this.props.exploreId, _this.props.showingGraph);
        };
        _this.onChangeTime = function (timeRange) {
            _this.props.changeTime(_this.props.exploreId, timeRange);
        };
        return _this;
    }
    GraphContainer.prototype.render = function () {
        var _a = this.props, exploreId = _a.exploreId, graphResult = _a.graphResult, loading = _a.loading, showingGraph = _a.showingGraph, showingTable = _a.showingTable, range = _a.range, split = _a.split, width = _a.width;
        var graphHeight = showingGraph && showingTable ? 200 : 400;
        if (!graphResult) {
            return null;
        }
        return (React.createElement(Panel, { label: "Graph", isOpen: showingGraph, loading: loading, onToggle: this.onClickGraphButton },
            React.createElement(Graph, { data: graphResult, height: graphHeight, id: "explore-graph-" + exploreId, onChangeTime: this.onChangeTime, range: range, split: split, width: width })));
    };
    return GraphContainer;
}(PureComponent));
export { GraphContainer };
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var split = explore.split;
    var item = explore[exploreId];
    var graphResult = item.graphResult, queryTransactions = item.queryTransactions, range = item.range, showingGraph = item.showingGraph, showingTable = item.showingTable;
    var loading = queryTransactions.some(function (qt) { return qt.resultType === 'Graph' && !qt.done; });
    return { graphResult: graphResult, loading: loading, range: range, showingGraph: showingGraph, showingTable: showingTable, split: split };
}
var mapDispatchToProps = {
    toggleGraph: toggleGraph,
    changeTime: changeTime,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(GraphContainer));
//# sourceMappingURL=GraphContainer.js.map