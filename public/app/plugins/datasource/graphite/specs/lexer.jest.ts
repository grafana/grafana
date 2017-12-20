import { Lexer } from '../lexer';

describe('when lexing graphite expression', function() {
  it('should tokenize metric expression', function() {
    var lexer = new Lexer('metric.test.*.asd.count');
    var tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('metric');
    expect(tokens[1].value).toBe('.');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[4].pos).toBe(13);
  });

  it('should tokenize metric expression with dash', function() {
    var lexer = new Lexer('metric.test.se1-server-*.asd.count');
    var tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[4].value).toBe('se1-server-*');
  });

  it('should tokenize metric expression with dash2', function() {
    var lexer = new Lexer('net.192-168-1-1.192-168-1-9.ping_value.*');
    var tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('net');
    expect(tokens[2].value).toBe('192-168-1-1');
  });

  it('should tokenize metric expression with equal sign', function() {
    var lexer = new Lexer('apps=test');
    var tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('apps=test');
  });

  it('simple function2', function() {
    var lexer = new Lexer('offset(test.metric, -100)');
    var tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[4].type).toBe('identifier');
    expect(tokens[6].type).toBe('number');
  });

  it('should tokenize metric expression with curly braces', function() {
    var lexer = new Lexer('metric.se1-{first, second}.count');
    var tokens = lexer.tokenize();
    expect(tokens.length).toBe(10);
    expect(tokens[3].type).toBe('{');
    expect(tokens[4].value).toBe('first');
    expect(tokens[5].value).toBe(',');
    expect(tokens[6].value).toBe('second');
  });

  it('should tokenize metric expression with number segments', function() {
    var lexer = new Lexer('metric.10.12_10.test');
    var tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('10');
    expect(tokens[4].value).toBe('12_10');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should tokenize metric expression with segment that start with number', function() {
    var lexer = new Lexer('metric.001-server');
    var tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens.length).toBe(3);
  });

  it('should tokenize func call with numbered metric and number arg', function() {
    var lexer = new Lexer('scale(metric.10, 15)');
    var tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('identifier');
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('metric');
    expect(tokens[4].value).toBe('10');
    expect(tokens[4].type).toBe('number');
    expect(tokens[6].type).toBe('number');
  });

  it('should tokenize metric with template parameter', function() {
    var lexer = new Lexer('metric.[[server]].test');
    var tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('[[server]]');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should tokenize metric with question mark', function() {
    var lexer = new Lexer('metric.server_??.test');
    var tokens = lexer.tokenize();
    expect(tokens[2].type).toBe('identifier');
    expect(tokens[2].value).toBe('server_??');
    expect(tokens[4].type).toBe('identifier');
  });

  it('should handle error with unterminated string', function() {
    var lexer = new Lexer("alias(metric, 'asd)");
    var tokens = lexer.tokenize();
    expect(tokens[0].value).toBe('alias');
    expect(tokens[1].value).toBe('(');
    expect(tokens[2].value).toBe('metric');
    expect(tokens[3].value).toBe(',');
    expect(tokens[4].type).toBe('string');
    expect(tokens[4].isUnclosed).toBe(true);
    expect(tokens[4].pos).toBe(20);
  });

  it('should handle float parameters', function() {
    var lexer = new Lexer('alias(metric, 0.002)');
    var tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('number');
    expect(tokens[4].value).toBe('0.002');
  });

  it('should handle bool parameters', function() {
    var lexer = new Lexer('alias(metric, true, false)');
    var tokens = lexer.tokenize();
    expect(tokens[4].type).toBe('bool');
    expect(tokens[4].value).toBe('true');
    expect(tokens[6].type).toBe('bool');
  });
});
