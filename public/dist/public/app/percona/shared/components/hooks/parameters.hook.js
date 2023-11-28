import { useEffect, useState, useMemo, useCallback } from 'react';
import { getLocationSrv } from '@grafana/runtime';
const useQueryParams = (key, defaultValue) => {
    const query = useMemo(() => new URLSearchParams(window.location.search), []);
    const [value, setValue] = useState(defaultValue !== null && defaultValue !== void 0 ? defaultValue : '');
    const setParameter = useCallback((parameter) => {
        getLocationSrv().update({
            query: { [key]: parameter },
            partial: true,
        });
        setValue(parameter);
    }, [key]);
    useEffect(() => {
        const queryValue = query.get(key);
        if (queryValue) {
            setValue(queryValue);
        }
        else {
            setParameter(value);
        }
    }, [key, query, setParameter, value]);
    return [value, setParameter];
};
export default useQueryParams;
//# sourceMappingURL=parameters.hook.js.map