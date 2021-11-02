import { createTraceFrame, transformToJaeger } from './responseTransform';
import { testResponse, testResponseDataFrameFields } from './testResponse';
import { MutableDataFrame } from '@grafana/data';
describe('createTraceFrame', function () {
    it('creates data frame from jaeger response', function () {
        var dataFrame = createTraceFrame(testResponse);
        expect(dataFrame.fields).toMatchObject(testResponseDataFrameFields);
    });
    it('transforms to jaeger format from data frame', function () {
        var dataFrame = createTraceFrame(testResponse);
        var response = transformToJaeger(new MutableDataFrame(dataFrame));
        expect(response).toMatchObject({ data: [testResponse] });
    });
});
//# sourceMappingURL=responseTransform.test.js.map