import { concatenateNewerLogs, concatenateOlderLogs } from './ChunkedLogsViewer.utils';
describe('ChunkedLogsViewer::utils', () => {
    it('should correctly concatenate newer logs', () => {
        expect(concatenateNewerLogs([{ id: 0, data: '', time: '' }], [], 3, 0)).toEqual([{ id: 0, data: '', time: '' }]);
        expect(concatenateNewerLogs([{ id: 2, data: '', time: '' }], [
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ], 2, 1)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
        ]);
        expect(concatenateNewerLogs([{ id: 2, data: '', time: '' }], [
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
        ]);
        expect(concatenateNewerLogs([{ id: 2, data: '', time: '' }], [
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
            { id: 8, data: '', time: '' },
            { id: 9, data: '', time: '' },
        ], 1, 5)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
        expect(concatenateNewerLogs([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ], [
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
            { id: 8, data: '', time: '' },
            { id: 9, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
        expect(concatenateNewerLogs([
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ], [
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
        expect(concatenateNewerLogs([
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ], [
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ], 2, 2)).toEqual([
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
    });
    it('should correctly concatenate older logs', () => {
        expect(concatenateOlderLogs([{ id: 0, data: '', time: '' }], [], 3, 1)).toEqual([{ id: 0, data: '', time: '' }]);
        expect(concatenateOlderLogs([{ id: 3, data: '', time: '' }], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
        ], 2, 1)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
        ]);
        expect(concatenateOlderLogs([{ id: 3, data: '', time: '' }], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
        ]);
        expect(concatenateOlderLogs([{ id: 7, data: '', time: '' }], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
        ], 1, 5)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
        expect(concatenateOlderLogs([
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ]);
        expect(concatenateOlderLogs([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
        ], 4, 2)).toEqual([
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
        ]);
        expect(concatenateOlderLogs([
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
            { id: 4, data: '', time: '' },
            { id: 5, data: '', time: '' },
            { id: 6, data: '', time: '' },
            { id: 7, data: '', time: '' },
        ], [
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
        ], 2, 2)).toEqual([
            { id: 0, data: '', time: '' },
            { id: 1, data: '', time: '' },
            { id: 2, data: '', time: '' },
            { id: 3, data: '', time: '' },
        ]);
    });
});
//# sourceMappingURL=ChunkedLogsViewer.utils.test.js.map