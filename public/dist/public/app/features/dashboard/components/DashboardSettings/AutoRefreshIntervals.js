import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, defaultIntervals, Field } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getTimeSrv } from '../../services/TimeSrv';
export const AutoRefreshIntervals = ({ refreshIntervals, onRefreshIntervalChange, getIntervalsFunc = getValidIntervals, validateIntervalsFunc = validateIntervals, }) => {
    const [intervals, setIntervals] = useState(getIntervalsFunc(refreshIntervals !== null && refreshIntervals !== void 0 ? refreshIntervals : defaultIntervals));
    const [invalidIntervalsMessage, setInvalidIntervalsMessage] = useState(null);
    useEffect(() => {
        const intervals = getIntervalsFunc(refreshIntervals !== null && refreshIntervals !== void 0 ? refreshIntervals : defaultIntervals);
        setIntervals(intervals);
    }, [getIntervalsFunc, refreshIntervals]);
    const intervalsString = useMemo(() => {
        if (!Array.isArray(intervals)) {
            return '';
        }
        return intervals.join(',');
    }, [intervals]);
    const onIntervalsChange = useCallback((event) => {
        const newIntervals = event.currentTarget.value ? event.currentTarget.value.split(',') : [];
        setIntervals(newIntervals);
    }, [setIntervals]);
    const onIntervalsBlur = useCallback((event) => {
        const invalidMessage = validateIntervalsFunc(intervals);
        if (invalidMessage === null) {
            // only refresh dashboard JSON if intervals are valid
            onRefreshIntervalChange(getIntervalsFunc(intervals));
        }
        setInvalidIntervalsMessage(invalidMessage);
    }, [getIntervalsFunc, intervals, onRefreshIntervalChange, validateIntervalsFunc]);
    return (React.createElement(Field, { label: t('dashboard-settings.general.auto-refresh-label', 'Auto refresh'), description: t('dashboard-settings.general.auto-refresh-description', 'Define the auto refresh intervals that should be available in the auto refresh list.'), error: invalidIntervalsMessage, invalid: !!invalidIntervalsMessage },
        React.createElement(Input, { id: "auto-refresh-input", invalid: !!invalidIntervalsMessage, value: intervalsString, onChange: onIntervalsChange, onBlur: onIntervalsBlur })));
};
export const validateIntervals = (intervals, dependencies = { getTimeSrv }) => {
    try {
        getValidIntervals(intervals, dependencies);
        return null;
    }
    catch (err) {
        return err instanceof Error ? err.message : 'Invalid intervals';
    }
};
export const getValidIntervals = (intervals, dependencies = { getTimeSrv }) => {
    const cleanIntervals = intervals.filter((i) => i.trim() !== '').map((interval) => interval.replace(/\s+/g, ''));
    return [...new Set(dependencies.getTimeSrv().getValidIntervals(cleanIntervals))];
};
//# sourceMappingURL=AutoRefreshIntervals.js.map