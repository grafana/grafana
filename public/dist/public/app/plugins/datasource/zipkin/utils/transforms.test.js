import { transformResponse, transformToZipkin } from './transforms';
import { traceFrameFields, zipkinResponse } from './testData';
import { MutableDataFrame } from '@grafana/data';
describe('transformResponse', function () {
    it('transforms response', function () {
        var dataFrame = transformResponse(zipkinResponse);
        expect(dataFrame.fields).toMatchObject(traceFrameFields);
    });
    it('converts dataframe to ZipkinSpan[]', function () {
        var dataFrame = transformResponse(zipkinResponse);
        var response = transformToZipkin(new MutableDataFrame(dataFrame));
        expect(response).toMatchObject(zipkinResponse);
    });
});
//# sourceMappingURL=transforms.test.js.map