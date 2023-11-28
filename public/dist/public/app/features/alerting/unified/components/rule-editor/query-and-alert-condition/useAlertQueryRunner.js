import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState } from '@grafana/data';
import { AlertingQueryRunner } from '../../../state/AlertingQueryRunner';
export function useAlertQueryRunner() {
    const [queryPreviewData, setQueryPreviewData] = useState({});
    const runner = useRef(new AlertingQueryRunner());
    useEffect(() => {
        const currentRunner = runner.current;
        currentRunner.get().subscribe((data) => {
            setQueryPreviewData(data);
        });
        return () => {
            currentRunner.destroy();
        };
    }, []);
    const clearPreviewData = useCallback(() => {
        setQueryPreviewData({});
    }, []);
    const cancelQueries = useCallback(() => {
        runner.current.cancel();
    }, []);
    const runQueries = useCallback((queriesToPreview) => {
        runner.current.run(queriesToPreview);
    }, []);
    const isPreviewLoading = useMemo(() => {
        return Object.values(queryPreviewData).some((d) => d.state === LoadingState.Loading);
    }, [queryPreviewData]);
    return { queryPreviewData, runQueries, cancelQueries, isPreviewLoading, clearPreviewData };
}
//# sourceMappingURL=useAlertQueryRunner.js.map