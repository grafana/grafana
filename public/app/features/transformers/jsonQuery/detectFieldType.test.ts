import { detectFieldType } from './detectFieldType';

describe('Detect FieldType', () => {
  it('years and months gets parsed as string to reduce false positives', () => {
    expect(detectFieldType(['2005', '2006'])).toStrictEqual('string');
    expect(detectFieldType(['2005-01', '2006-01'])).toStrictEqual('string');
  });

  it('iso8601 date without time zone gets parsed as time', () => {
    expect(detectFieldType(['2005-01-02', '2006-01-02'])).toStrictEqual('time');
  });

  it('unix epoch in seconds gets parsed as number', () => {
    expect(detectFieldType([1617774880])).toStrictEqual('number');
  });

  it('unix epoch in milliseconds gets parsed as number', () => {
    expect(detectFieldType([1617774880000])).toStrictEqual('number');
  });

  it('iso8601 gets parsed as time', () => {
    expect(detectFieldType(['2022-11-08T09:05:50.989654408Z', '2006-01-02T15:07:13Z'])).toStrictEqual('time');
  });

  it('nullable iso8601 gets parsed as time', () => {
    expect(detectFieldType(['2006-01-02T15:06:13Z', null])).toStrictEqual('time');
  });

  it('regression for #202', () => {
    expect(detectFieldType(['foo bar 1.1'])).toStrictEqual('string');
  });

  it('floating-point numbers with string length 13 get parsed as number', () => {
    expect(detectFieldType([12.0000000003, 72.0000000001])).toStrictEqual('number');
  });

  it('all zeros gets parsed as number', () => {
    expect(detectFieldType([0, 0, 0])).toStrictEqual('number');
    expect(detectFieldType([0, 0, 1])).toStrictEqual('number');
  });

  it('array of array numbers are detected', () => {
    expect(detectFieldType([[0, 0, 0]])).toStrictEqual('number');
    expect(detectFieldType([[0, 0, 1]])).toStrictEqual('number');
  });

  it('all false gets parsed as boolean', () => {
    expect(detectFieldType([false, false, false])).toStrictEqual('boolean');
    expect(detectFieldType([false, false, true])).toStrictEqual('boolean');
  });

  it('all null gets parsed as string', () => {
    expect(detectFieldType([null, null])).toStrictEqual('string');
  });
});
