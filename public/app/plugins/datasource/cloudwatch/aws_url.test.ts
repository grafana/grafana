import { encodeObject } from './aws_url';

describe('AWS Url Utilities', () => {
  it('should properly encode a string', () => {
    expect(encodeObject('ABC')).toEqual("'ABC");
    expect(encodeObject('ABC DEF')).toEqual("'ABC*20DEF");
    expect(encodeObject('ABCĂ')).toEqual("'ABC**0102");
  });

  it('should properly encode a number', () => {
    expect(encodeObject(23)).toEqual('23');
    expect(encodeObject(257)).toEqual('257');
  });

  it('should properly encode a boolean', () => {
    expect(encodeObject(true)).toEqual('true');
    expect(encodeObject(false)).toEqual('false');
  });

  it('should properly encode an array of strings', () => {
    expect(encodeObject(['ABC', 'ABC DEF', 'ABCĂ'])).toEqual("(~'ABC~'ABC*20DEF~'ABC**0102)");
  });

  it('should properly encode an array of numbers', () => {
    expect(encodeObject([1, 57, 34])).toEqual('(~1~57~34)');
  });

  it('should properly encode an object', () => {
    const myObject = {
      end: 50,
      start: 1,
      timeType: 'UTC',
      editorString: 'fields @message | limit 20',
      isLiveTail: false,
      source: ['syslogs', 'grafana', 'test'],
    };

    expect(encodeObject(myObject)).toEqual(
      "(end~50~start~1~timeType~'UTC~editorString~'fields*20*40message*20*7c*20limit*2020~isLiveTail~false~source~(~'syslogs~'grafana~'test))"
    );
  });
});
