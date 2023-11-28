import { useEffect, useRef, useState } from 'react';
import { LoadingState } from '@grafana/data';
/**
 * Subscribes and returns latest panel data from PanelQueryRunner
 */
export const usePanelLatestData = (panel, options, checkSchema) => {
    var _a;
    const querySubscription = useRef();
    const [latestData, setLatestData] = useState();
    useEffect(() => {
        let lastRev = -1;
        let lastUpdate = 0;
        querySubscription.current = panel
            .getQueryRunner()
            // We apply field config later
            .getData({ withTransforms: options.withTransforms, withFieldConfig: false })
            .subscribe({
            next: (data) => {
                var _a;
                if (checkSchema) {
                    if (lastRev === data.structureRev) {
                        const now = Date.now();
                        const elapsed = now - lastUpdate;
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
        return () => {
            if (querySubscription.current) {
                querySubscription.current.unsubscribe();
            }
        };
        /**
         * Adding separate options to dependencies array to avoid additional hook for comparing previous options with current.
         * Otherwise, passing different references to the same object might cause troubles.
         */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel, options.withTransforms]);
    return {
        data: latestData,
        isLoading: (latestData === null || latestData === void 0 ? void 0 : latestData.state) === LoadingState.Loading,
        hasSeries: latestData ? !!latestData.series : false,
        hasError: Boolean(latestData && (latestData.error || ((_a = latestData === null || latestData === void 0 ? void 0 : latestData.errors) === null || _a === void 0 ? void 0 : _a.length) || latestData.state === LoadingState.Error)),
    };
};
//# sourceMappingURL=usePanelLatestData.js.map