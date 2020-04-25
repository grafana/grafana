import { transformResponse } from './transforms';
import { jaegerTrace, zipkinResponse } from './testData';

describe('transformResponse', () => {
  it('transforms response', () => {
    expect(transformResponse(zipkinResponse)).toEqual(jaegerTrace);
  });
});
