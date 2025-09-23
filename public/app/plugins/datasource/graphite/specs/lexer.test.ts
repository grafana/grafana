import { Lexer } from '../lexer';

describe('when lexing graphite expression', () => {
  it('should tokenize metric expression', () => {
    const lexer = new Lexer('metric.test.*.asd.count');
    const tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('metric');
    expect(tokens[1].value).toBe('.');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[4].pos).toBe(13);
  });

  it('should tokenize metric expression with dash', () => {
    const lexer = new Lexer('metric.test.se1-server-*.asd.count');
    const tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[4].value).toBe('se1-server-*');
  });

  it('should tokenize metric expression with dash2', () => {
    const lexer = new Lexer('net.192-168-1-1.192-168-1-9.ping_value.*');
    const tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('net');
    expect(tokens[2].value).toBe('192-168-1-1');
  });

  it('should tokenize metric expression with equal sign', () => {
    const lexer = new Lexer('apps=test');
    const tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('apps=test');
  });

  it('simple function2', () => {
    const lexer = new Lexer('offset(test.metric, -100)');
    const tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[6].type).toBe('number');
  });

  it('should tokenize metric expression with curly braces', () => {
    const lexer = new Lexer('metric.se1-{first, second}.count');
    const tokens = lexer.tokenize();
    expect(tokens.length).toBe(10);
    expect(tokens[3].type).toBe('{');
    expect(tokens[4].value).toBe('first');
    expect(tokens[5].value).toBe(',');
    expect(tokens[6].value).toBe('second');
  });

  it('should tokenize metric expression with number segments', () => {
    const lexer = new Lexer('metric.10.12_10.test');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('10');
    expect(tokens[4].value).toBe('12_10');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should tokenize metric expression with segment that start with number', () => {
    const lexer = new Lexer('metric.001-server');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens.length).toBe(3);
  });

  it('should tokenize func call with numbered metric and number arg', () => {
    const lexer = new Lexer('scale(metric.10, 15)');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('metric');
    expect(tokens[4].value).toBe('10');
    expect(tokens[4].type).toBe('number');
    expect(tokens[6].type).toBe('number');
  });

  it('should tokenize metric with template parameter', () => {
    const lexer = new Lexer('metric.[[server]].test');
    const tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('[[server]]');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should tokenize metric with question mark', () => {
    const lexer = new Lexer('metric.server_??.test');
    const tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('server_??');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should handle error with unterminated string', () => {
    const lexer = new Lexer("alias(metric, 'asd)");
    const tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('alias');
    expect(tokens[1].value).toBe('(');
    expect(tokens[2].value).toBe('metric');
    expect(tokens[3].value).toBe(',');
    expect(tokens[4].type).toBe('string');
    expect(tokens[4].isUnclosed).toBe(true);
    expect(tokens[4].pos).toBe(20);
  });

  it('should handle float parameters', () => {
    const lexer = new Lexer('alias(metric, 0.002)');
    const tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('number');
    expect(tokens[4].value).toBe('0.002');
  });

  it('should handle bool parameters', () => {
    const lexer = new Lexer('alias(metric, true, false)');
    const tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('bool');
    expect(tokens[4].value).toBe('true');
    expect(tokens[6].type).toBe('bool');
  });
});
