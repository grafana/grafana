import axios from 'axios';
import { useRef, useEffect, useCallback } from 'react';
export const useCancelToken = () => {
    const tokens = useRef({});
    const cancelToken = useCallback((sourceName) => {
        tokens.current[sourceName] && tokens.current[sourceName].cancel();
    }, []);
    const generateToken = useCallback((sourceName) => {
        cancelToken(sourceName);
        const tokenSource = axios.CancelToken.source();
        tokens.current = Object.assign(Object.assign({}, tokens.current), { [sourceName]: tokenSource });
        return tokenSource.token;
    }, [cancelToken]);
    useEffect(() => () => {
        Object.keys(tokens.current).forEach((sourceName) => {
            cancelToken(sourceName);
        });
    }, [cancelToken]);
    return [generateToken, cancelToken];
};
//# sourceMappingURL=cancelToken.hook.js.map