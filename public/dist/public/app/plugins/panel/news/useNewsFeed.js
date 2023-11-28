import { __awaiter } from "tslib";
import { useAsyncFn } from 'react-use';
import { DataFrameView } from '@grafana/data';
import { loadFeed } from './feed';
import { feedToDataFrame } from './utils';
export function useNewsFeed(url) {
    const [state, getNews] = useAsyncFn(() => __awaiter(this, void 0, void 0, function* () {
        const feed = yield loadFeed(url);
        const frame = feedToDataFrame(feed);
        return new DataFrameView(frame);
    }), [url], { loading: true });
    return { state, getNews };
}
//# sourceMappingURL=useNewsFeed.js.map