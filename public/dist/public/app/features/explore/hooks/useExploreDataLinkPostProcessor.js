import { useMemo } from 'react';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';
export const useExploreDataLinkPostProcessor = (splitOpenFn, timeRange) => {
    return useMemo(() => {
        return exploreDataLinkPostProcessorFactory(splitOpenFn, timeRange);
    }, [splitOpenFn, timeRange]);
};
//# sourceMappingURL=useExploreDataLinkPostProcessor.js.map