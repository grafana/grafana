import { useEffect, useState } from 'react';

import { ApiCall } from '../types';

export const useApiCall = <R, A>(
  apiFn: (apiFnArgs?: A) => Promise<R>,
  apiFnArgs?: A,
  apiFnArgsRetry?: A,
  retryDefault = true
): ApiCall<R, A> => {
  const [data, setData] = useState<R>();
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const apiCall = async (apiFnArgs?: A, retry = retryDefault) => {
    setIsLoading(true);

    try {
      const response = await apiFn(apiFnArgs);

      if (!response) {
        throw Error('Invalid response received');
      }

      setData(response);
    } catch (e) {
      // retry the call once with different arguments
      if (retry) {
        await apiCall(apiFnArgsRetry, false);
      } else {
        console.error(e);
        //@ts-ignore
        setErrorMessage(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    apiCall(apiFnArgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [data, errorMessage, isLoading, apiCall];
};
