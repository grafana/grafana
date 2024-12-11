import { VAR_OTEL_JOIN_QUERY_EXPR } from '../../shared';

import { GENERAL_BASE_QUERY, GENERAL_RATE_BASE_QUERY, getGeneralBaseQuery } from './baseQuery';

describe('getGeneralBaseQuery', () => {
  it('should return the rate-based query when rate is true', () => {
    const result = getGeneralBaseQuery(true);
    expect(result).toBe(`${GENERAL_RATE_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`);
  });

  it('should return the base query when rate is false', () => {
    const result = getGeneralBaseQuery(false);
    expect(result).toBe(`${GENERAL_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`);
  });

  it('should handle edge cases gracefully', () => {
    // Test with explicit boolean true
    const resultTrue = getGeneralBaseQuery(true);
    expect(resultTrue).toBe(`${GENERAL_RATE_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`);

    // Test with explicit boolean false
    const resultFalse = getGeneralBaseQuery(false);
    expect(resultFalse).toBe(`${GENERAL_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`);
  });
});
