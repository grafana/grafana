import { transformResponse } from './transforms';
import { traceFrameFields, zipkinResponse } from './testData';

describe('transformResponse', () => {
  it('transforms response', () => {
    const dataFrame = transformResponse(zipkinResponse);

    expect(dataFrame.fields).toMatchObject(traceFrameFields);
  });
});
