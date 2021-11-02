import { __read } from "tslib";
import { LoadingState } from '@grafana/data';
import { useEffect, useRef, useState } from 'react';
/**
 * Subscribes and returns latest panel data from PanelQueryRunner
 */
export var usePanelLatestData = function (panel, options, checkSchema) {
    var querySubscription = useRef();
    var _a = __read(useState(), 2), latestData = _a[0], setLatestData = _a[1];
    useEffect(function () {
        var lastRev = -1;
        var lastUpdate = 0;
        querySubscription.current = panel
            .getQueryRunner()
            .getData(options)
            .subscribe({
            next: function (data) {
                var _a;
                if (checkSchema) {
                    if (lastRev === data.structureRev) {
                        var now = Date.now();
                        var elapsed = now - lastUpdate;
                        if (elapsed < 10000) {
                            return; // avoid updates if the schema has not changed for 10s
                        }
                        lastUpdate = now;
                    }
                    lastRev = (_a = data.structureRev) !== null && _a !== void 0 ? _a : -1;
                }
                setLatestData(data);
            },
        });
        return function () {
            if (querySubscription.current) {
                querySubscription.current.unsubscribe();
            }
        };
        /**
         * Adding separate options to dependencies array to avoid additional hook for comparing previous options with current.
         * Otherwise, passing different references to the same object might cause troubles.
         */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel, options.withFieldConfig, options.withTransforms]);
    return {
        data: latestData,
        error: latestData && latestData.error,
        isLoading: latestData ? latestData.state === LoadingState.Loading : true,
        hasSeries: latestData ? !!latestData.series : false,
    };
};
//# sourceMappingURL=usePanelLatestData.js.map