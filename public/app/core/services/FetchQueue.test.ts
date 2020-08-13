import { BackendSrvRequest } from '@grafana/runtime';
import { FetchQueue, FetchQueueUpdate, FetchStatus } from './FetchQueue';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

type SubscribeTesterArgs = {
  observable: Observable<T>;
  expect: (data: T) => void;
  done: jest.DoneCallback;
};

const subscribeTester = <T>({ observable, expect, done }: SubscribeTesterArgs) => {
  observable.subscribe({
    next: data => expect(data),
    complete: () => {
      done();
    },
  });
};

describe('FetchQueue', () => {
  describe('add', () => {
    describe('when called twice', () => {
      it('then an update with the correct state should be published', done => {
        const id = 'id';
        const id2 = 'id2';
        const options: BackendSrvRequest = { url: 'http://someurl' };
        const options2: BackendSrvRequest = { url: 'http://someotherurl' };
        const expects: FetchQueueUpdate[] = [
          {
            noOfPending: 1,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
            },
          },
          {
            noOfPending: 2,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
              ['id2']: { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
            },
          },
        ];
        const queue = new FetchQueue();
        let calls = 0;

        subscribeTester({
          observable: queue.getUpdates().pipe(take(2)),
          expect: data => expect(data).toEqual(expects[calls++]),
          done: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
      });
    });
  });

  describe('setStarted', () => {
    describe('when called', () => {
      it('then an update with the correct state should be published', done => {
        const id = 'id';
        const id2 = 'id2';
        const options: BackendSrvRequest = { url: 'http://someurl' };
        const options2: BackendSrvRequest = { url: 'http://someotherurl' };
        const expects: FetchQueueUpdate[] = [
          {
            noOfPending: 1,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
            },
          },
          {
            noOfPending: 2,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
              ['id2']: { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
            },
          },
          {
            noOfPending: 1,
            noOfInProgress: 1,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
              ['id2']: { options: { url: 'http://someotherurl' }, state: FetchStatus.InProgress },
            },
          },
        ];
        const queue = new FetchQueue();
        let calls = 0;

        subscribeTester({
          observable: queue.getUpdates().pipe(take(3)),
          expect: data => expect(data).toEqual(expects[calls++]),
          done: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
        queue.setStarted(id2);
      });
    });
  });

  describe('setEnded', () => {
    describe('when called', () => {
      it('then an update with the correct state should be published', done => {
        const id = 'id';
        const id2 = 'id2';
        const options: BackendSrvRequest = { url: 'http://someurl' };
        const options2: BackendSrvRequest = { url: 'http://someotherurl' };
        const expects: FetchQueueUpdate[] = [
          {
            noOfPending: 1,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
            },
          },
          {
            noOfPending: 2,
            noOfInProgress: 0,
            state: {
              ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
              ['id2']: { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
            },
          },
          {
            noOfPending: 1,
            noOfInProgress: 0,
            state: {
              ['id2']: { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
            },
          },
        ];
        const queue = new FetchQueue();
        let calls = 0;

        subscribeTester({
          observable: queue.getUpdates().pipe(take(3)),
          expect: data => expect(data).toEqual(expects[calls++]),
          done: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
        queue.setEnded(id);
      });
    });
  });
});
