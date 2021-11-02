import React from 'react';
import { RefreshPicker, defaultIntervals } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
export function RunButton(props) {
    var isSmall = props.isSmall, loading = props.loading, onRun = props.onRun, onChangeRefreshInterval = props.onChangeRefreshInterval, refreshInterval = props.refreshInterval, showDropdown = props.showDropdown, isLive = props.isLive;
    var intervals = getTimeSrv().getValidIntervals(defaultIntervals);
    var text;
    if (isLive) {
        return null;
    }
    if (!isSmall) {
        text = loading ? 'Cancel' : 'Run query';
    }
    return (React.createElement(RefreshPicker, { onIntervalChanged: onChangeRefreshInterval, value: refreshInterval, isLoading: loading, text: text, intervals: intervals, isLive: isLive, onRefresh: function () { return onRun(loading); }, noIntervalPicker: !showDropdown, primary: true }));
}
//# sourceMappingURL=RunButton.js.map