import React from 'react';
import { TabbedContainer } from '@grafana/ui';
import { runQueries } from './state/query';
import { connect } from 'react-redux';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
export function ExploreQueryInspector(props) {
    var _a;
    var loading = props.loading, width = props.width, onClose = props.onClose, queryResponse = props.queryResponse;
    var dataFrames = (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.series) || [];
    var error = queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.error;
    var statsTab = {
        label: 'Stats',
        value: 'stats',
        icon: 'chart-line',
        content: React.createElement(InspectStatsTab, { data: queryResponse, timeZone: (_a = queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.request) === null || _a === void 0 ? void 0 : _a.timezone }),
    };
    var jsonTab = {
        label: 'JSON',
        value: 'json',
        icon: 'brackets-curly',
        content: React.createElement(InspectJSONTab, { data: queryResponse, onClose: onClose }),
    };
    var dataTab = {
        label: 'Data',
        value: 'data',
        icon: 'database',
        content: (React.createElement(InspectDataTab, { data: dataFrames, isLoading: loading, options: { withTransforms: false, withFieldConfig: false } })),
    };
    var queryTab = {
        label: 'Query',
        value: 'query',
        icon: 'info-circle',
        content: React.createElement(QueryInspector, { data: dataFrames, onRefreshQuery: function () { return props.runQueries(props.exploreId); } }),
    };
    var tabs = [statsTab, queryTab, jsonTab, dataTab];
    if (error) {
        var errorTab = {
            label: 'Error',
            value: 'error',
            icon: 'exclamation-triangle',
            content: React.createElement(InspectErrorTab, { error: error }),
        };
        tabs.push(errorTab);
    }
    return (React.createElement(ExploreDrawer, { width: width, onResize: function () { } },
        React.createElement(TabbedContainer, { tabs: tabs, onClose: onClose, closeIconTooltip: "Close query inspector" })));
}
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var item = explore[exploreId];
    var loading = item.loading, queryResponse = item.queryResponse;
    return {
        loading: loading,
        queryResponse: queryResponse,
    };
}
var mapDispatchToProps = {
    runQueries: runQueries,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(ExploreQueryInspector);
//# sourceMappingURL=ExploreQueryInspector.js.map