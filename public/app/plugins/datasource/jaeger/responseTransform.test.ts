import { MutableDataFrame } from '@grafana/data';

import { createTraceFrame, transformToJaeger } from './responseTransform';
import { testResponse, testResponseDataFrameFields } from './testResponse';

describe('createTraceFrame', () => {
  it('creates data frame from jaeger response', () => {
    const dataFrame = createTraceFrame(testResponse);
    expect(dataFrame.fields).toMatchObject(testResponseDataFrameFields);
  });

  it('transforms to jaeger format from data frame', () => {
    const dataFrame = createTraceFrame(testResponse);
    const response = transformToJaeger(new MutableDataFrame(dataFrame));
    expect(response).toMatchObject({ data: [testResponse] });
  });
});
