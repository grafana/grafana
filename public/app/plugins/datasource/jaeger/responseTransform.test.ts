import { createTraceFrame } from './responseTransform';
import { testResponse, testResponseDataFrameFields } from './testResponse';

describe('createTraceFrame', () => {
  it('creates data frame from jaeger response', () => {
    const dataFrame = createTraceFrame(testResponse);
    expect(dataFrame.fields).toMatchObject(testResponseDataFrameFields);
  });
});
