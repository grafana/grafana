import { SerializedError } from '@reduxjs/toolkit';

import { logger } from 'app/percona/shared/helpers/logger';

import { PERCONA_CANCELLED_ERROR_NAME } from '../../core/constants';
import { isApiCancelError } from '../../helpers/api';

// Used to safely return from a side effect that might trigger when the component unmounted
// and some promise resolved in the meanwhile
export const useCatchCancellationError = () => {
  const catchFromAsyncThunkAction = async <T>(p: Promise<T & { error?: SerializedError }>): Promise<T | void> => {
    const data = await p;
    const { error } = data;

    if (error) {
      if (error.name === PERCONA_CANCELLED_ERROR_NAME) {
        return;
      } else {
        logger.error(error);
      }
    }

    return data;
  };

  const catchFromApiPromise = async <T>(p: Promise<T>): Promise<T | void> => {
    try {
      const data = await p;
      return data;
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
  };

  return [catchFromAsyncThunkAction, catchFromApiPromise] as const;
};
