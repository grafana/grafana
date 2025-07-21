import { take } from 'rxjs/operators';

import { BackendSrvRequest } from '@grafana/runtime';

import { FetchQueue, FetchQueueUpdate, FetchStatus } from './FetchQueue';
import { subscribeTester } from './mocks/subscribeTester';

describe('FetchQueue', () => {
  describe('add', () => {
    describe('when called twice', () => {
      it('then an update with the correct state should be published', (done) => {
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
          expectCallback: (data) => expect(data).toEqual(expects[calls++]),
          doneCallback: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
      });
    });
  });

  describe('setInProgress', () => {
    describe('when called', () => {
      it('then an update with the correct state should be published', (done) => {
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
          expectCallback: (data) => expect(data).toEqual(expects[calls++]),
          doneCallback: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
        queue.setInProgress(id2);
      });
    });
  });

  describe('setDone', () => {
    describe('when called', () => {
      it('then an update with the correct state should be published', (done) => {
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
          expectCallback: (data) => expect(data).toEqual(expects[calls++]),
          doneCallback: done,
        });

        queue.add(id, options);
        queue.add(id2, options2);
        queue.setDone(id);
      });
    });
  });
});
