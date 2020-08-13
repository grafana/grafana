import { BackendSrvRequest } from '@grafana/runtime';
import { FetchQueue, FetchQueueUpdate, FetchStatus } from './FetchQueue';
import { ResponseQueue } from './ResponseQueue';
import { of } from 'rxjs';
import { first } from 'rxjs/operators';
import { subscribeTester } from './FetchQueue.test';

const getTestContext = () => {
  const id = 'id';
  const options: BackendSrvRequest = { url: 'http://someurl' };
  const expects: FetchQueueUpdate[] = [];
  const fetchMock = jest.fn().mockReturnValue(
    of({
      data: id,
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: (null as unknown) as Headers,
      redirected: false,
      type: (null as unknown) as ResponseType,
      url: options.url,
      config: (null as unknown) as BackendSrvRequest,
    }).pipe(first())
  );
  const queue = new FetchQueue();
  const responseQueue = new ResponseQueue(queue, fetchMock);

  return { id, options, expects, fetchMock, queue, responseQueue };
};

describe('ResponseQueue', () => {
  describe('add', () => {
    describe('when called', () => {
      it('then the matching fetchQueue entry should be set to inProgress', done => {
        const { id, options, queue, responseQueue } = getTestContext();
        const expected = {
          noOfPending: 0,
          noOfInProgress: 1,
          state: {
            ['id']: { options: { url: 'http://someurl' }, state: FetchStatus.InProgress },
          },
        };

        // pushing this before setting up the subscription means this value isn't published on the stream
        queue.add(id, options);

        subscribeTester({
          observable: queue.getUpdates().pipe(first()),
          expectCallback: data => expect(data).toEqual(expected),
          doneCallback: done,
        });

        responseQueue.add(id, options);
      });

      it('then a response entry with correct id should be published', done => {
        const { id, options, queue, responseQueue } = getTestContext();

        queue.add(id, options);

        subscribeTester({
          observable: responseQueue.getResponses(id).pipe(first()),
          expectCallback: data => expect(data.id).toEqual(id),
          doneCallback: done,
        });

        responseQueue.add(id, options);
      });

      it('then fetch is called with correct options', done => {
        const { id, options, queue, responseQueue, fetchMock } = getTestContext();

        queue.add(id, options);

        subscribeTester({
          observable: responseQueue.getResponses(id).pipe(first()),
          expectCallback: data => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith({ url: 'http://someurl' });
          },
          doneCallback: done,
        });

        responseQueue.add(id, options);
      });
    });
  });
});
