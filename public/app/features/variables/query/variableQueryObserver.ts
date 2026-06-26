import { Observer, Subscription } from 'rxjs';

import { LoadingState } from '@grafana/data';

import { UpdateOptionsResults } from './VariableQueryRunner';

export function variableQueryObserver(
  resolve: (value?: any) => void,
  reject: (value?: any) => void,
  subscription: Subscription
): Observer<UpdateOptionsResults> {
  const observer: Observer<UpdateOptionsResults> = {
    next: (results) => {
      if (results.state === LoadingState.Error) {
        subscription.unsubscribe();
        reject(results.error);
        return;
      }

      if (results.state === LoadingState.Done) {
        subscription.unsubscribe();
        resolve();
        return;
      }
    },
    error: (err) => {
      subscription.unsubscribe();
      reject(err);
    },
    complete: () => {
      subscription.unsubscribe();
      resolve();
    },
  };

  return observer;
}
