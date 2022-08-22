import { Subject } from 'rxjs';

import { DataQueryResponse, FieldType, LiveChannelScope } from '@grafana/data';

import { StreamingDataQueryResponse } from './centrifuge/service';
import { StreamingDataFrame } from './data/StreamingDataFrame';
import { StreamingResponseDataType } from './data/utils';
import { GrafanaLiveService } from './live';

describe('GrafanaLiveService', () => {
  const deps = {
    backendSrv: {},
    centrifugeSrv: {
      getDataStream: jest.fn(),
    },
  };

  const liveService = new GrafanaLiveService(deps as any);

  const liveDataStreamOptions = {
    addr: {
      scope: LiveChannelScope.Grafana,
      namespace: ' abc',
      path: 'abc',
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should map response from Centrifuge Service to a streaming data frame', async () => {
    const dummySubject = new Subject<StreamingDataQueryResponse>();
    deps.centrifugeSrv.getDataStream.mockReturnValueOnce(dummySubject);

    let response: DataQueryResponse | undefined;
    liveService.getDataStream(liveDataStreamOptions).subscribe((next) => {
      response = next;
    });

    dummySubject.next({
      data: [
        {
          type: StreamingResponseDataType.FullFrame,
          frame: StreamingDataFrame.empty().serialize(),
        },
      ],
    });

    expect(response).not.toBeUndefined();
    expect(response?.data[0]).toBeInstanceOf(StreamingDataFrame);
  });

  it('should add partial streaming data to the buffer', async () => {
    const dummySubject = new Subject<StreamingDataQueryResponse>();
    deps.centrifugeSrv.getDataStream.mockReturnValueOnce(dummySubject);

    let response: DataQueryResponse | undefined;
    liveService.getDataStream(liveDataStreamOptions).subscribe((next) => {
      response = next;
    });

    dummySubject.next({
      data: [
        {
          type: StreamingResponseDataType.FullFrame,
          frame: StreamingDataFrame.fromDataFrameJSON({
            schema: {
              fields: [
                { name: 'time', type: FieldType.time },
                { name: 'a', type: FieldType.string },
                { name: 'b', type: FieldType.number },
              ],
            },
          }).serialize(),
        },
      ],
    });
    dummySubject.next({
      data: [
        {
          type: StreamingResponseDataType.NewValuesSameSchema,
          values: [
            [100, 101],
            ['a', 'b'],
            [1, 2],
          ],
        },
      ],
    });

    expect(response).not.toBeUndefined();
    const frame: StreamingDataFrame = response?.data[0];
    expect(frame).toBeInstanceOf(StreamingDataFrame);
    expect(frame.fields).toEqual([
      {
        config: {},
        name: 'time',
        type: FieldType.time,
        values: {
          buffer: [100, 101],
        },
      },
      {
        config: {},
        name: 'a',
        type: FieldType.string,
        values: {
          buffer: ['a', 'b'],
        },
      },
      {
        config: {},
        name: 'b',
        type: FieldType.number,
        values: {
          buffer: [1, 2],
        },
      },
    ]);
  });

  it('should return an empty frame if first message was not a full frame', async () => {
    jest.spyOn(console, 'warn').mockImplementation(jest.fn);
    const dummySubject = new Subject<StreamingDataQueryResponse>();
    deps.centrifugeSrv.getDataStream.mockReturnValueOnce(dummySubject);

    let response: DataQueryResponse | undefined;
    liveService.getDataStream(liveDataStreamOptions).subscribe((next) => {
      response = next;
    });

    dummySubject.next({
      data: [
        {
          type: StreamingResponseDataType.NewValuesSameSchema,
          values: [
            [100, 101],
            ['a', 'b'],
            [1, 2],
          ],
        },
      ],
    });

    expect(response).not.toBeUndefined();
    const frame: StreamingDataFrame = response?.data[0];
    expect(frame).toBeInstanceOf(StreamingDataFrame);
    expect(frame.fields).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});
