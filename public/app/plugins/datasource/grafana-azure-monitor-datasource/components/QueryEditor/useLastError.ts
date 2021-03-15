import { useState, useCallback, useMemo } from 'react';
import { AzureMonitorUIError } from '../../types';
import { messageFromError } from './messageFromError';

type SourcedError = [string, AzureMonitorUIError];

export default function useLastError() {
  const [errors, setErrors] = useState<SourcedError[]>([]);

  // Handles errors from any child components that request data to display their options
  const handleError = useCallback((errorSource: string, error: Error | undefined) => {
    setErrors((errors) => {
      const errorsCopy = [...errors];
      const index = errors.findIndex(([vSource]) => vSource === errorSource);

      // If there's already an error, remove it. If we're setting a new error, we'll move it to the front
      if (index > -1) {
        errorsCopy.splice(index, 1);
      }

      // And then add the new error to the top of the array. If error is defined, it was already
      // removed above.
      if (error) {
        errorsCopy.unshift([errorSource, error]);
      }

      return errorsCopy;
    });
  }, []);

  // TODO: display error message from executing query (data.error??)
  const errorMessage = useMemo(() => {
    const recentError = errors[0];
    return recentError && messageFromError(recentError[1]);
  }, [errors]);

  return [errorMessage, handleError] as const;
}
