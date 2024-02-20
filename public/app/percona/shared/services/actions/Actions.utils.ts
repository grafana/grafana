import { backOff } from 'exponential-backoff';

import { ActionsService } from './Actions.service';
import { ActionResult } from './Actions.types';

const INTERVAL = 500;

export const getActionResult = async <T>(actionId: string): Promise<ActionResult<T>> => {
  const getData = async () => {
    const result = await ActionsService.getActionResult<T>({
      action_id: actionId,
    });

    if (!result.done && !result.error) {
      throw Error('');
    }

    return result;
  };

  let requestResult;

  try {
    requestResult = await backOff(() => getData(), {
      startingDelay: INTERVAL,
      numOfAttempts: 10,
      delayFirstAttempt: false,
    });
  } catch (e) {
    return {
      loading: false,
      value: null,
      error: 'Unknown error',
    };
  }

  if (requestResult.error) {
    return {
      loading: false,
      value: requestResult.output,
      error: requestResult.error,
    };
  }

  return {
    loading: false,
    value: requestResult.output,
    error: '',
  };
};
