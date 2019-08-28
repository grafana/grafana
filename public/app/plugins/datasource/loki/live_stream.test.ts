import { Subject } from 'rxjs';
import * as rxJsWebSocket from 'rxjs/webSocket';
import { LiveStream, BufferedData } from './live_stream';
import { DataFrameView } from '@grafana/data';

describe('Live Stream Tests', () => {
  let fakeSocket: Subject<any>;
  let buffer: BufferedData;
  let stream: LiveStream;
  let view: DataFrameView;
  const commonLabels = { job: 'varlogs' };

  beforeEach(async () => {
    fakeSocket = new Subject<any>();
    spyOn(rxJsWebSocket, 'webSocket').and.returnValue(fakeSocket);
    stream = new LiveStream('fakeurl', commonLabels, 10);
    buffer = (stream as any).data; // access private buffer
    view = new DataFrameView(buffer.frame);
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

  it('reads the values into the buffer', () => {
    fakeSocket.next(initialRawResponse);

    expect(buffer.frame.length).toBe(7);

    fakeSocket.next(msg0);
    expect(buffer.frame.length).toBe(8);

    // Get the values from the last line
    const last = { ...view.get(view.length - 1) };
    expect(last).toEqual({
      ts: '2019-08-28T20:50:40.118944705Z',
      line: 'Kittens',
      labels: { filename: '/var/log/sntpc.log' },
    });
  });
});

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
