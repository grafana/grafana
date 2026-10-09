import { parseSyntheticsFilter } from './syntheticsFilter';

const stored = {
  datasourceUid: 'uid-a',
  datasourceName: 'Prometheus',
  job: ['canary'],
  instance: ['https://shop.example'],
  probe: ['Amsterdam'],
};

describe('parseSyntheticsFilter', () => {
  it('reads a missing, malformed or wrongly shaped value as every check counting', () => {
    expect(parseSyntheticsFilter(undefined)).toBeNull();
    expect(parseSyntheticsFilter('{not json')).toBeNull();
    expect(parseSyntheticsFilter(JSON.stringify({ ...stored, job: 'canary' }))).toBeNull();
  });

  it('trims values, drops blank entries and reads what is left empty as every check counting', () => {
    expect(
      parseSyntheticsFilter(JSON.stringify({ ...stored, job: ['', ' canary '], instance: [' '], probe: [] }))
    ).toEqual({ ...stored, job: ['canary'], instance: [], probe: [] });
    expect(parseSyntheticsFilter(JSON.stringify({ ...stored, job: [''], instance: [' '], probe: [] }))).toBeNull();
  });
});
