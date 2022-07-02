import { noop } from 'lodash';
import { Observable, Subject, of, throwError, concat } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import * as rxJsWebSocket from 'rxjs/webSocket';

import { DataFrame, DataFrameView, formatLabels, Labels } from '@grafana/data';

import { LiveStreams } from './live_streams';
import { LokiTailResponse } from './types';

let fakeSocket: Subject<any>;
jest.mock('rxjs/webSocket', () => {
  return {
    __esModule: true,
    webSocket: () => fakeSocket,
  };
});

describe('Live Stream Tests', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const msg0: LokiTailResponse = {
    streams: [
      {
        stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
        values: [['1567025440118944705', 'Kittens']],
      },
    ],
    dropped_entries: null,
  };

  it('reads the values into the buffer', (done) => {
    fakeSocket = new Subject<any>();
    const labels: Labels = { job: 'varlogs' };
    const target = makeTarget('fake', labels);
    const stream = new LiveStreams().getStream(target);
    expect.assertions(4);

    const tests = [
      (val: DataFrame[]) => {
        expect(val[0].length).toEqual(7);
        expect(val[0].fields[2].labels).toEqual(labels);
      },
      (val: DataFrame[]) => {
        expect(val[0].length).toEqual(8);
        const view = new DataFrameView(val[0]);
        const last = { ...view.get(view.length - 1) };
        expect(last).toEqual({
          Time: '2019-08-28T20:50:40.118Z',
          tsNs: '1567025440118944705',
          id: '25d81461-a66f-53ff-98d5-e39515af4735_A',
          Line: 'Kittens',
          labels: { filename: '/var/log/sntpc.log' },
        });
      },
    ];
    stream.subscribe({
      next: (val) => {
        const test = tests.shift();
        test!(val);
      },
      complete: () => done(),
    });

    // Send it the initial list of things
    fakeSocket.next(initialRawResponse);
    // Send it a single update
    fakeSocket.next(msg0);
    fakeSocket.complete();
  });

  it('returns the same subscription if the url matches existing one', () => {
    fakeSocket = new Subject<any>();
    const liveStreams = new LiveStreams();
    const stream1 = liveStreams.getStream(makeTarget('url_to_match'));
    const stream2 = liveStreams.getStream(makeTarget('url_to_match'));
    expect(stream1).toBe(stream2);
  });

  it('returns new subscription when the previous unsubscribed', () => {
    fakeSocket = new Subject<any>();
    const liveStreams = new LiveStreams();
    const stream1 = liveStreams.getStream(makeTarget('url_to_match'));
    const subscription = stream1.subscribe({
      next: noop,
    });
    subscription.unsubscribe();

    const stream2 = liveStreams.getStream(makeTarget('url_to_match'));
    expect(stream1).not.toBe(stream2);
  });

  it('returns new subscription when the previous is unsubscribed and correctly unsubscribes from source', () => {
    let unsubscribed = false;
    fakeSocket = new Observable(() => {
      return () => (unsubscribed = true);
    }) as any;
    jest.spyOn(rxJsWebSocket, 'webSocket').mockReturnValue(fakeSocket as rxJsWebSocket.WebSocketSubject<unknown>);

    const liveStreams = new LiveStreams();
    const stream1 = liveStreams.getStream(makeTarget('url_to_match'));
    const subscription = stream1.subscribe({
      next: noop,
    });
    subscription.unsubscribe();
    expect(unsubscribed).toBe(true);
  });
  it('should reconnect when abnormal error', async () => {
    const abnormalError = new Error('weird error') as any;
    abnormalError.code = 1006;
    const logStreamBeforeError = of({
      streams: [
        {
          stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
          values: [['1567025440118944705', 'Kittens']],
        },
      ],
      dropped_entries: null,
    });
    const logStreamAfterError = of({
      streams: [
        {
          stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
          values: [['1567025440118944705', 'Doggos']],
        },
      ],
      dropped_entries: null,
    });
    const errorStream = throwError(abnormalError);
    let retries = 0;
    fakeSocket = of({}).pipe(
      mergeMap(() => {
        // When subscribed first time, return logStream and errorStream
        if (retries++ === 0) {
          return concat(logStreamBeforeError, errorStream);
        }
        // When re-subsribed after abnormal error, return just logStream
        return logStreamAfterError;
      })
    ) as any;
    jest.spyOn(rxJsWebSocket, 'webSocket').mockReturnValue(fakeSocket as rxJsWebSocket.WebSocketSubject<unknown>);
    const liveStreams = new LiveStreams();
    await expect(liveStreams.getStream(makeTarget('url_to_match'), 100)).toEmitValuesWith((received) => {
      const data = received[0];
      const view = new DataFrameView(data[0]);
      const firstLog = { ...view.get(0) };
      const secondLog = { ...view.get(1) };

      expect(firstLog.Line).toBe('Kittens');
      expect(secondLog.Line).toBe('Doggos');
      expect(retries).toBe(2);
    });
  });
});

/**
 * Create target (query to run). Url is what is used as cache key.
 */
function makeTarget(url: string, labels?: Labels) {
  labels = labels || { job: 'varlogs' };
  return {
    url,
    size: 10,
    query: formatLabels(labels),
    refId: 'A',
    regexp: '',
  };
}

//----------------------------------------------------------------
// Added this at the end so the top is more readable
//----------------------------------------------------------------

const initialRawResponse: LokiTailResponse = {
  streams: [
    {
      stream: {
        filename: '/var/log/docker.log',
        job: 'varlogs',
      },
      values: [
        [
          '1567025018215000000',
          'level=debug msg="[resolver] received AAAA record \\"::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
        ],
        [
          '1567025018215000000',
          '2019-08-28T20:43:38Z docker time="2019-08-28T20:43:38.147224630Z" ' +
            'level=debug msg="[resolver] received AAAA record \\"fe80::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
        ],
        ['1567025020452000000', '2019-08-28T20:43:40Z sntpc sntpc[1]: offset=-0.022171, delay=0.000463'],
        ['1567025050297000000', '2019-08-28T20:44:10Z sntpc sntpc[1]: offset=-0.022327, delay=0.000527'],
        [
          '1567025078152000000',
          '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095444834Z" ' +
            'level=debug msg="Name To resolve: localhost."',
        ],
        [
          '1567025078152000000',
          '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095896074Z" ' +
            'level=debug msg="[resolver] query localhost. (A) from 172.22.0.4:53748, forwarding to udp:192.168.65.1"',
        ],
        [
          '1567025078152000000',
          '2019-08-28T20:44:38Z docker time="2019-08-28T20:44:38.095444834Z" level=debug msg="Name To resolve: localhost."',
        ],
      ],
    },
  ],
  dropped_entries: null,
};
