import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
export const useApiCall = (apiFn, apiFnArgs, apiFnArgsRetry, retryDefault = true) => {
    const [data, setData] = useState();
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const apiCall = (apiFnArgs, retry = retryDefault) => __awaiter(void 0, void 0, void 0, function* () {
        setIsLoading(true);
        try {
            const response = yield apiFn(apiFnArgs);
            if (!response) {
                throw Error('Invalid response received');
            }
            setData(response);
        }
        catch (e) {
            // retry the call once with different arguments
            if (retry) {
                yield apiCall(apiFnArgsRetry, false);
            }
            else {
                console.error(e);
                //@ts-ignore
                setErrorMessage(e);
            }
        }
        finally {
            setIsLoading(false);
        }
    });
    useEffect(() => {
        apiCall(apiFnArgs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return [data, errorMessage, isLoading, apiCall];
};
//# sourceMappingURL=useApiCall.js.map