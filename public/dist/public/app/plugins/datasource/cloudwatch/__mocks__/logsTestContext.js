import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { dataFrameToJSON, MutableDataFrame, } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { CloudWatchLogsQueryStatus } from '../types';
import { meta, setupMockedDataSource } from './CloudWatchDataSource';
export function setupForLogs() {
    function envelope(frame) {
        return { data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } };
    }
    const { datasource, fetchMock, timeSrv } = setupMockedDataSource();
    const startQueryFrame = new MutableDataFrame({ fields: [{ name: 'queryId', values: ['queryid'] }] });
    fetchMock.mockReturnValueOnce(of(envelope(startQueryFrame)));
    const logsFrame = new MutableDataFrame({
        fields: [
            {
                name: '@message',
                values: ['something'],
            },
            {
                name: '@timestamp',
                values: [1],
            },
            {
                name: '@xrayTraceId',
                values: ['1-613f0d6b-3e7cb34375b60662359611bd'],
            },
        ],
        meta: { custom: { Status: CloudWatchLogsQueryStatus.Complete } },
    });
    fetchMock.mockReturnValueOnce(of(envelope(logsFrame)));
    setDataSourceSrv({
        get() {
            return __awaiter(this, void 0, void 0, function* () {
                const ds = {
                    name: 'Xray',
                    id: 0,
                    type: '',
                    uid: '',
                    query: function (request) {
                        throw new Error('Function not implemented.');
                    },
                    testDatasource: function () {
                        throw new Error('Function not implemented.');
                    },
                    meta: meta,
                    getRef: function () {
                        throw new Error('Function not implemented.');
                    },
                };
                return ds;
            });
        },
        getList: function (filters) {
            throw new Error('Function not implemented.');
        },
        getInstanceSettings: function (ref, scopedVars) {
            throw new Error('Function not implemented.');
        },
        reload: function () {
            throw new Error('Function not implemented.');
        },
    });
    return { datasource, fetchMock, timeSrv };
}
//# sourceMappingURL=logsTestContext.js.map