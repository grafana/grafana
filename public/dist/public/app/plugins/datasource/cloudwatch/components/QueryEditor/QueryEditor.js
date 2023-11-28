import React, { useCallback, useEffect, useState } from 'react';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from '../../guards';
import LogsQueryEditor from './LogsQueryEditor/LogsQueryEditor';
import { MetricsQueryEditor } from './MetricsQueryEditor/MetricsQueryEditor';
import QueryHeader from './QueryHeader';
export const QueryEditor = (props) => {
    const { query, onChange, data } = props;
    const [dataIsStale, setDataIsStale] = useState(false);
    const [extraHeaderElementLeft, setExtraHeaderElementLeft] = useState();
    const [extraHeaderElementRight, setExtraHeaderElementRight] = useState();
    useEffect(() => {
        setDataIsStale(false);
    }, [data]);
    const onChangeInternal = useCallback((query) => {
        setDataIsStale(true);
        onChange(query);
    }, [onChange]);
    return (React.createElement(React.Fragment, null,
        React.createElement(QueryHeader, Object.assign({}, props, { extraHeaderElementLeft: extraHeaderElementLeft, extraHeaderElementRight: extraHeaderElementRight, dataIsStale: dataIsStale })),
        isCloudWatchMetricsQuery(query) && (React.createElement(MetricsQueryEditor, Object.assign({}, props, { query: query, onRunQuery: () => { }, onChange: onChangeInternal, extraHeaderElementLeft: setExtraHeaderElementLeft, extraHeaderElementRight: setExtraHeaderElementRight }))),
        isCloudWatchLogsQuery(query) && React.createElement(LogsQueryEditor, Object.assign({}, props, { query: query, onChange: onChangeInternal }))));
};
//# sourceMappingURL=QueryEditor.js.map