import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { CoreApp, LoadingState } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import { defaultTimeZone } from '@grafana/schema';
import { TabbedContainer } from '@grafana/ui';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { runQueries } from './state/query';
export function ExploreQueryInspector(props) {
    var _a, _b;
    const { width, onClose, queryResponse, timeZone } = props;
    const dataFrames = (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.series) || [];
    let errors = queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.errors;
    if (!(errors === null || errors === void 0 ? void 0 : errors.length) && (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.error)) {
        errors = [queryResponse.error];
    }
    useEffect(() => {
        reportInteraction('grafana_explore_query_inspector_opened');
    }, []);
    const statsTab = {
        label: 'Stats',
        value: 'stats',
        icon: 'chart-line',
        content: React.createElement(InspectStatsTab, { data: queryResponse, timeZone: (_b = (_a = queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.request) === null || _a === void 0 ? void 0 : _a.timezone) !== null && _b !== void 0 ? _b : defaultTimeZone }),
    };
    const jsonTab = {
        label: 'JSON',
        value: 'json',
        icon: 'brackets-curly',
        content: React.createElement(InspectJSONTab, { data: queryResponse, onClose: onClose }),
    };
    const dataTab = {
        label: 'Data',
        value: 'data',
        icon: 'database',
        content: (React.createElement(InspectDataTab, { data: dataFrames, dataName: 'Explore', isLoading: queryResponse.state === LoadingState.Loading, options: { withTransforms: false, withFieldConfig: false }, timeZone: timeZone, app: CoreApp.Explore })),
    };
    const queryTab = {
        label: 'Query',
        value: 'query',
        icon: 'info-circle',
        content: (React.createElement(QueryInspector, { data: queryResponse, onRefreshQuery: () => props.runQueries({ exploreId: props.exploreId }) })),
    };
    const tabs = [statsTab, queryTab, jsonTab, dataTab];
    if (errors === null || errors === void 0 ? void 0 : errors.length) {
        const errorTab = {
            label: 'Error',
            value: 'error',
            icon: 'exclamation-triangle',
            content: React.createElement(InspectErrorTab, { errors: errors }),
        };
        tabs.push(errorTab);
    }
    return (React.createElement(ExploreDrawer, { width: width },
        React.createElement(TabbedContainer, { tabs: tabs, onClose: onClose, closeIconTooltip: "Close query inspector" })));
}
function mapStateToProps(state, { exploreId }) {
    const explore = state.explore;
    const item = explore.panes[exploreId];
    const { queryResponse } = item;
    return {
        queryResponse,
    };
}
const mapDispatchToProps = {
    runQueries,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(ExploreQueryInspector);
//# sourceMappingURL=ExploreQueryInspector.js.map