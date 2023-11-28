import { useEffect, useMemo, useState } from 'react';
export function useAsyncState(asyncFn, setError, dependencies) {
    // Use the lazy initial state functionality of useState to assign a random ID to the API call
    // to track where errors come from. See useLastError.
    const [errorSource] = useState(() => Math.random());
    const [value, setValue] = useState();
    const finalValue = useMemo(() => value !== null && value !== void 0 ? value : [], [value]);
    useEffect(() => {
        asyncFn()
            .then((results) => {
            setValue(results);
            setError(errorSource, undefined);
        })
            .catch((err) => {
            setError(errorSource, err);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
    return finalValue;
}
//# sourceMappingURL=useAsyncState.js.map