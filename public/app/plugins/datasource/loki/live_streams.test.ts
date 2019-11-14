import { Subject, Observable } from 'rxjs';
import * as rxJsWebSocket from 'rxjs/webSocket';
import { LiveStreams } from './live_streams';
import { DataFrameView, Labels, formatLabels, DataFrame } from '@grafana/data';
import { noop } from 'lodash';

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

  const msg0: any = {
    streams: [
      {
        labels: '{filename="/var/log/sntpc.log", job="varlogs"}',
        entries: [
          {
            ts: '2019-08-28T20:50:40.118944705Z',
            line: 'Kittens',
          },
        ],
      },
    ],
    dropped_entries: null,
  };

  it('reads the values into the buffer', done => {
    fakeSocket = new Subject<any>();
    const labels: Labels = { job: 'varlogs' };
    const target = makeTarget('fake', labels);
    const stream = new LiveStreams().getStream(target);
    expect.assertions(4);

    const tests = [
      (val: DataFrame[]) => {
        expect(val[0].length).toEqual(7);
        expect(val[0].fields[1].labels).toEqual(labels);
      },
      (val: DataFrame[]) => {
        expect(val[0].length).toEqual(8);
        const view = new DataFrameView(val[0]);
        const last = { ...view.get(view.length - 1) };
        expect(last).toEqual({
          ts: '2019-08-28T20:50:40.118944705Z',
          id: '2019-08-28T20:50:40.118944705Z_{filename="/var/log/sntpc.log", job="varlogs"}',
          line: 'Kittens',
          labels: { filename: '/var/log/sntpc.log' },
        });
      },
    ];
    stream.subscribe({
      next: val => {
        const test = tests.shift();
        test(val);
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
    const spy = spyOn(rxJsWebSocket, 'webSocket');
    spy.and.returnValue(fakeSocket);

    const liveStreams = new LiveStreams();
    const stream1 = liveStreams.getStream(makeTarget('url_to_match'));
    const subscription = stream1.subscribe({
      next: noop,
    });
    subscription.unsubscribe();
    expect(unsubscribed).toBe(true);
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

const initialRawResponse: any = {
  streams: [
    {
      labels: '{filename="/var/log/docker.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:43:38.215447855Z',
          line:
            '2019-08-28T20:43:38Z docker time="2019-08-28T20:43:38.147149490Z" ' +
            'level=debug msg="[resolver] received AAAA record \\"::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
        },
      ],
    },
    {
      labels: '{filename="/var/log/docker.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:43:38.215450388Z',
          line:
            '2019-08-28T20:43:38Z docker time="2019-08-28T20:43:38.147224630Z" ' +
            'level=debug msg="[resolver] received AAAA record \\"fe80::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
        },
      ],
    },
    {
      labels: '{filename="/var/log/sntpc.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:43:40.452525099Z',
          line: '2019-08-28T20:43:40Z sntpc sntpc[1]: offset=-0.022171, delay=0.000463',
        },
      ],
    },
    {
      labels: '{filename="/var/log/sntpc.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:44:10.297164454Z',
          line: '2019-08-28T20:44:10Z sntpc sntpc[1]: offset=-0.022327, delay=0.000527',
        },
      ],
    },
    {
      labels: '{filename="/var/log/lifecycle-server.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:44:38.152248647Z',
          line:
            '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095444834Z" ' +
            'level=debug msg="Name To resolve: localhost."',
        },
      ],
    },
    {
      labels: '{filename="/var/log/lifecycle-server.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:44:38.15225554Z',
          line:
            '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095896074Z" ' +
            'level=debug msg="[resolver] query localhost. (A) from 172.22.0.4:53748, forwarding to udp:192.168.65.1"',
        },
      ],
    },
    {
      labels: '{filename="/var/log/docker.log", job="varlogs"}',
      entries: [
        {
          ts: '2019-08-28T20:44:38.152271475Z',
          line:
            '2019-08-28T20:44:38Z docker time="2019-08-28T20:44:38.095444834Z" level=debug msg="Name To resolve: localhost."',
        },
      ],
    },
  ],
  dropped_entries: null,
};
