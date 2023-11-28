import { __awaiter } from "tslib";
import { Subject } from 'rxjs';
import { FieldType, LiveChannelScope, StreamingDataFrame } from '@grafana/data';
import { StreamingResponseDataType } from './data/utils';
import { GrafanaLiveService } from './live';
describe('GrafanaLiveService', () => {
    const mockGetDataStream = jest.fn();
    const deps = {
        backendSrv: {},
        centrifugeSrv: {
            getDataStream: mockGetDataStream,
        },
    };
    const liveService = new GrafanaLiveService(deps);
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
    it('should map response from Centrifuge Service to a streaming data frame', () => __awaiter(void 0, void 0, void 0, function* () {
        const dummySubject = new Subject();
        mockGetDataStream.mockReturnValueOnce(dummySubject);
        let response;
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
        expect(response === null || response === void 0 ? void 0 : response.data[0]).toBeInstanceOf(StreamingDataFrame);
    }));
    it('should add partial streaming data to the buffer', () => __awaiter(void 0, void 0, void 0, function* () {
        const dummySubject = new Subject();
        mockGetDataStream.mockReturnValueOnce(dummySubject);
        let response;
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
        const frame = response === null || response === void 0 ? void 0 : response.data[0];
        expect(frame).toBeInstanceOf(StreamingDataFrame);
        expect(frame.fields).toEqual([
            {
                config: {},
                name: 'time',
                type: FieldType.time,
                values: [100, 101],
            },
            {
                config: {},
                name: 'a',
                type: FieldType.string,
                values: ['a', 'b'],
            },
            {
                config: {},
                name: 'b',
                type: FieldType.number,
                values: [1, 2],
            },
        ]);
    }));
    it('should return an empty frame if first message was not a full frame', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(console, 'warn').mockImplementation(jest.fn);
        const dummySubject = new Subject();
        mockGetDataStream.mockReturnValueOnce(dummySubject);
        let response;
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
        const frame = response === null || response === void 0 ? void 0 : response.data[0];
        expect(frame).toBeInstanceOf(StreamingDataFrame);
        expect(frame.fields).toEqual([]);
        expect(console.warn).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=live.test.js.map