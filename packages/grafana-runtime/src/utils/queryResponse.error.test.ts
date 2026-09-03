import { LoadingState } from '@grafana/data';

import { toDataQueryResponse } from './queryResponse';

describe('toDataQueryResponse', () => {
  it('returns an error when parsing the response body throws', () => {
    const error = new SyntaxError('Unexpected end of JSON input');

    const response = toDataQueryResponse(error);

    expect(response.state).toBe(LoadingState.Error);
    expect(response.error?.message).toBe(error.message);
  });
});
