import { transformResponse, transformToZipkin } from './transforms';
import { traceFrameFields, zipkinResponse } from './testData';
import { MutableDataFrame } from '@grafana/data';

describe('transformResponse', () => {
  it('transforms response', () => {
    const dataFrame = transformResponse(zipkinResponse);

    expect(dataFrame.fields).toMatchObject(traceFrameFields);
  });
  it('converts dataframe to ZipkinSpan[]', () => {
    const dataFrame = transformResponse(zipkinResponse);
    const response = transformToZipkin(new MutableDataFrame(dataFrame));
    // TODO - figure out shared, figure out remote vs local endpoint. Otherwise change test and move on
    expect(response).toMatchObject(zipkinResponse);
  });
});
