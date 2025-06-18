import { Observable } from 'rxjs';

type SubscribeTesterArgs<T> = {
  observable: Observable<T>;
  expectCallback: (data: T) => void;
  doneCallback: jest.DoneCallback;
};

export const subscribeTester = <T>({ observable, expectCallback, doneCallback }: SubscribeTesterArgs<T>) => {
  observable.subscribe({
    next: (data) => expectCallback(data),
    complete: () => {
      doneCallback();
    },
  });
};
