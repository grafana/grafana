import { TemplateSrv } from '@grafana/runtime';

import { getCurrentTimeRange } from './time';

function getFakeTemplateSrv(text: string): TemplateSrv {
  return {
    replace: () => text,
    getVariables: () => [],
    containsTemplate: () => false,
    updateTimeRange: () => undefined,
  };
}

describe('getCurrentTimeRange', () => {
  it('should parse valid values', () => {
    const templateSrv = getFakeTemplateSrv('1694503944572 1694504244572');
    const range = getCurrentTimeRange(templateSrv);
    expect(range.from.valueOf()).toBe(1694503944572);
    expect(range.to.valueOf()).toBe(1694504244572);
  });

  it('should reject empty string', () => {
    const templateSrv = getFakeTemplateSrv('');
    const getRange = () => getCurrentTimeRange(templateSrv);
    expect(getRange).toThrow('time range info unavailable');
  });

  it('should reject single space', () => {
    const templateSrv = getFakeTemplateSrv(' ');
    const getRange = () => getCurrentTimeRange(templateSrv);
    expect(getRange).toThrow('time range info unavailable');
  });

  it('should reject not-numbers', () => {
    const templateSrv = getFakeTemplateSrv('asdf');
    const getRange = () => getCurrentTimeRange(templateSrv);
    expect(getRange).toThrow('time range info unavailable');
  });
});
