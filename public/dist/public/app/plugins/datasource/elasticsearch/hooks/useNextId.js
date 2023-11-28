import { useMemo } from 'react';
import { useQuery } from '../components/QueryEditor/ElasticsearchQueryContext';
const toId = (e) => e.id;
const toInt = (idString) => parseInt(idString, 10);
export const useNextId = () => {
    const { metrics, bucketAggs } = useQuery();
    return useMemo(() => (Math.max(...[...((metrics === null || metrics === void 0 ? void 0 : metrics.map(toId)) || ['0']), ...((bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.map(toId)) || ['0'])].map(toInt)) + 1).toString(), [metrics, bucketAggs]);
};
//# sourceMappingURL=useNextId.js.map