import { of } from 'rxjs';
import { first } from 'rxjs/operators';

import { BackendSrvRequest } from '@grafana/runtime';

import { FetchQueue, FetchQueueUpdate } from './FetchQueue';
import { subscribeTester } from './FetchQueue.test';
import { ResponseQueue } from './ResponseQueue';

const getTestContext = () => {
  const id = 'id';
  const options: BackendSrvRequest = { url: 'http://someurl' };
  const expects: FetchQueueUpdate[] = [];

  const fetchResult = of({
    data: id,
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: null as unknown as Headers,
    redirected: false,
    type: null as unknown as ResponseType,
    url: options.url,
    config: null as unknown as BackendSrvRequest,
  });

  const fetchMock = jest.fn().mockReturnValue(fetchResult);
  const setInProgressMock = jest.fn();

  const queueMock: FetchQueue = {
    add: jest.fn(),
    setInProgress: setInProgressMock,
    setDone: jest.fn(),
    getUpdates: jest.fn(),
  } as unknown as FetchQueue;

  const responseQueue = new ResponseQueue(queueMock, fetchMock);

  return { id, options, expects, fetchMock, setInProgressMock, responseQueue, fetchResult };
};

describe('ResponseQueue', () => {
  describe('add', () => {
    describe('when called', () => {
      it('then the matching fetchQueue entry should be set to inProgress', () => {
        const { id, options, setInProgressMock, responseQueue } = getTestContext();

        responseQueue.add(id, options);

        expect(setInProgressMock.mock.calls).toEqual([['id']]);
      });

      it('then a response entry with correct id should be published', (done) => {
        const { id, options, responseQueue } = getTestContext();

        subscribeTester({
          observable: responseQueue.getResponses(id).pipe(first()),
          expectCallback: (data) => expect(data.id).toEqual(id),
          doneCallback: done,
        });

        responseQueue.add(id, options);
      });

      it('then fetch is called with correct options', (done) => {
        const { id, options, responseQueue, fetchMock } = getTestContext();

        subscribeTester({
          observable: responseQueue.getResponses(id).pipe(first()),
          expectCallback: () => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith({ url: 'http://someurl' });
          },
          doneCallback: done,
        });

        responseQueue.add(id, options);
      });

      describe('and when the fetch Observable is completed', () => {
        it('then the matching fetchQueue entry should be set to Done', (done) => {
          const { id, options, responseQueue, setInProgressMock } = getTestContext();

          subscribeTester({
            observable: responseQueue.getResponses(id).pipe(first()),
            expectCallback: (data) => {
              data.observable.subscribe().unsubscribe();
              expect(setInProgressMock.mock.calls).toEqual([['id']]);
            },
            doneCallback: done,
          });

          responseQueue.add(id, options);
        });
      });
    });
  });
});
