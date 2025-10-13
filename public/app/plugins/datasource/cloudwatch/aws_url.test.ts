import { getLogsEndpoint } from './aws_url';

describe('getEndpoint', () => {
  it('should return the default url for normal regions', () => {
    const result = getLogsEndpoint('us-east-1');
    expect(result).toBe('us-east-1.console.aws.amazon.com');
  });

  it('should return the us-gov url for us-gov regions', () => {
    const result = getLogsEndpoint('us-gov-east-1');
    expect(result).toBe('us-gov-east-1.console.amazonaws-us-gov.com');
  });

  it('should return the china url for cn regions', () => {
    const result = getLogsEndpoint('cn-northwest-1');
    expect(result).toBe('cn-northwest-1.console.amazonaws.cn');
  });
});
