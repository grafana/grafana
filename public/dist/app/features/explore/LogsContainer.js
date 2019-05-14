import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { LogsDedupStrategy } from 'app/core/logs_model';
import { toggleLogs, changeDedupStrategy } from './state/actions';
import Logs from './Logs';
import Panel from './Panel';
import { toggleLogLevelAction } from 'app/features/explore/state/actionTypes';
import { deduplicatedLogsSelector, exploreItemUIStateSelector } from 'app/features/explore/state/selectors';
var LogsContainer = /** @class */ (function (_super) {
    tslib_1.__extends(LogsContainer, _super);
    function LogsContainer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClickLogsButton = function () {
            _this.props.toggleLogs(_this.props.exploreId, _this.props.showingLogs);
        };
        _this.handleDedupStrategyChange = function (dedupStrategy) {
            _this.props.changeDedupStrategy(_this.props.exploreId, dedupStrategy);
        };
        _this.hangleToggleLogLevel = function (hiddenLogLevels) {
            var exploreId = _this.props.exploreId;
            _this.props.toggleLogLevelAction({
                exploreId: exploreId,
                hiddenLogLevels: hiddenLogLevels,
            });
        };
        return _this;
    }
    LogsContainer.prototype.render = function () {
        var _a = this.props, exploreId = _a.exploreId, loading = _a.loading, logsHighlighterExpressions = _a.logsHighlighterExpressions, logsResult = _a.logsResult, dedupedResult = _a.dedupedResult, onChangeTime = _a.onChangeTime, onClickLabel = _a.onClickLabel, onStartScanning = _a.onStartScanning, onStopScanning = _a.onStopScanning, range = _a.range, showingLogs = _a.showingLogs, scanning = _a.scanning, scanRange = _a.scanRange, width = _a.width, hiddenLogLevels = _a.hiddenLogLevels;
        return (React.createElement(Panel, { label: "Logs", loading: loading, isOpen: showingLogs, onToggle: this.onClickLogsButton },
            React.createElement(Logs, { dedupStrategy: this.props.dedupStrategy || LogsDedupStrategy.none, data: logsResult, dedupedData: dedupedResult, exploreId: exploreId, key: logsResult && logsResult.id, highlighterExpressions: logsHighlighterExpressions, loading: loading, onChangeTime: onChangeTime, onClickLabel: onClickLabel, onStartScanning: onStartScanning, onStopScanning: onStopScanning, onDedupStrategyChange: this.handleDedupStrategyChange, onToggleLogLevel: this.hangleToggleLogLevel, range: range, scanning: scanning, scanRange: scanRange, width: width, hiddenLogLevels: hiddenLogLevels })));
    };
    return LogsContainer;
}(PureComponent));
export { LogsContainer };
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var item = explore[exploreId];
    var logsHighlighterExpressions = item.logsHighlighterExpressions, logsResult = item.logsResult, queryTransactions = item.queryTransactions, scanning = item.scanning, scanRange = item.scanRange, range = item.range;
    var loading = queryTransactions.some(function (qt) { return qt.resultType === 'Logs' && !qt.done; });
    var _b = exploreItemUIStateSelector(item), showingLogs = _b.showingLogs, dedupStrategy = _b.dedupStrategy;
    var hiddenLogLevels = new Set(item.hiddenLogLevels);
    var dedupedResult = deduplicatedLogsSelector(item);
    return {
        loading: loading,
        logsHighlighterExpressions: logsHighlighterExpressions,
        logsResult: logsResult,
        scanning: scanning,
        scanRange: scanRange,
        showingLogs: showingLogs,
        range: range,
        dedupStrategy: dedupStrategy,
        hiddenLogLevels: hiddenLogLevels,
        dedupedResult: dedupedResult,
    };
}
var mapDispatchToProps = {
    toggleLogs: toggleLogs,
    changeDedupStrategy: changeDedupStrategy,
    toggleLogLevelAction: toggleLogLevelAction,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(LogsContainer));
//# sourceMappingURL=LogsContainer.js.map