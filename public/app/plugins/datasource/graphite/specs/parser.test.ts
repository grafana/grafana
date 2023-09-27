import { Parser } from '../parser';

describe('when parsing', () => {
  it('simple metric expression', () => {
    const parser = new Parser('metric.test.*.asd.count');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(5);
      expect(rootNode.segments[0].value).toBe('metric');
    }
  });

  it('simple metric expression with numbers in segments', () => {
    const parser = new Parser('metric.10.15_20.5');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(4);
      expect(rootNode.segments[1].value).toBe('10');
      expect(rootNode.segments[2].value).toBe('15_20');
      expect(rootNode.segments[3].value).toBe('5');
    }
  });

  it('simple metric expression with "true" boolean in segments', () => {
    const parser = new Parser('metric.15_20.5.true');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(4);
      expect(rootNode.segments[1].value).toBe('15_20');
      expect(rootNode.segments[2].value).toBe('5');
      expect(rootNode.segments[3].value).toBe('true');
    }
  });

  it('simple metric expression with "false" boolean in segments', () => {
    const parser = new Parser('metric.false.15_20.5');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(4);
      expect(rootNode.segments[1].value).toBe('false');
      expect(rootNode.segments[2].value).toBe('15_20');
      expect(rootNode.segments[3].value).toBe('5');
    }
  });

  it('simple metric expression with curly braces', () => {
    const parser = new Parser('metric.se1-{count, max}');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(2);
      expect(rootNode.segments[1].value).toBe('se1-{count,max}');
    }
  });

  it('simple metric expression with curly braces at start of segment and with post chars', () => {
    const parser = new Parser('metric.{count, max}-something.count');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments.length).toBe(3);
      expect(rootNode.segments[1].value).toBe('{count,max}-something');
    }
  });

  it('simple function', () => {
    const parser = new Parser('sum(test)');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params.length).toBe(1);
    }
  });

  it('simple function2', () => {
    const parser = new Parser('offset(test.metric, -100)');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params[0].type).toBe('metric');
      expect(rootNode.params[1].type).toBe('number');
    }
  });

  it('simple function with string arg', () => {
    const parser = new Parser("randomWalk('test')");
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params.length).toBe(1);
      expect(rootNode.params[0].type).toBe('string');
    }
  });

  it('function with multiple args', () => {
    const parser = new Parser("sum(test, 1, 'test')");
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params.length).toBe(3);
      expect(rootNode.params[0].type).toBe('metric');
      expect(rootNode.params[1].type).toBe('number');
      expect(rootNode.params[2].type).toBe('string');
    }
  });

  it('function with nested function', () => {
    const parser = new Parser('sum(scaleToSeconds(test, 1))');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params && rootNode.params[0].params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params.length).toBe(1);
      expect(rootNode.params[0].type).toBe('function');
      expect(rootNode.params[0].name).toBe('scaleToSeconds');
      expect(rootNode.params[0].params.length).toBe(2);
      expect(rootNode.params[0].params[0].type).toBe('metric');
      expect(rootNode.params[0].params[1].type).toBe('number');
    }
  });

  it('function with multiple series', () => {
    const parser = new Parser('sum(test.test.*.count, test.timers.*.count)');
    const rootNode = parser.getAst();
    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params.length).toBe(2);
      expect(rootNode.params[0].type).toBe('metric');
      expect(rootNode.params[1].type).toBe('metric');
    }
  });

  it('function with templated series', () => {
    const parser = new Parser('sum(test.[[server]].count)');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params && rootNode.params[0].segments) {
      expect(rootNode.message).toBe(undefined);
      expect(rootNode.params[0].type).toBe('metric');
      expect(rootNode.params[0].segments[1].type).toBe('segment');
      expect(rootNode.params[0].segments[1].value).toBe('[[server]]');
    }
  });

  it('invalid metric expression', () => {
    const parser = new Parser('metric.test.*.asd.');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.message && rootNode.pos) {
      expect(rootNode.message).toBe('Expected metric identifier instead found end of string');
      expect(rootNode.pos).toBe(19);
    }
  });

  it('invalid function expression missing closing parenthesis', () => {
    const parser = new Parser('sum(test');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.message && rootNode.pos) {
      expect(rootNode.message).toBe('Expected closing parenthesis instead found end of string');
      expect(rootNode.pos).toBe(9);
    }
  });

  it('unclosed string in function', () => {
    const parser = new Parser("sum('test)");
    const rootNode = parser.getAst();
    if (rootNode && rootNode.message && rootNode.pos) {
      expect(rootNode.message).toBe('Unclosed string parameter');
      expect(rootNode.pos).toBe(11);
    }
  });

  it('handle issue #69', () => {
    const parser = new Parser('cactiStyle(offset(scale(net.192-168-1-1.192-168-1-9.ping_value.*,0.001),-100))');
    const rootNode = parser.getAst();
    if (rootNode) {
      expect(rootNode.type).toBe('function');
    }
  });

  it('handle float function arguments', () => {
    const parser = new Parser('scale(test, 0.002)');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params[1].type).toBe('number');
      expect(rootNode.params[1].value).toBe(0.002);
    }
  });

  it('handle curly brace pattern at start', () => {
    const parser = new Parser('{apps}.test');
    const rootNode = parser.getAst();
    if (rootNode && rootNode.segments) {
      expect(rootNode.type).toBe('metric');
      expect(rootNode.segments[0].value).toBe('{apps}');
      expect(rootNode.segments[1].value).toBe('test');
    }
  });

  it('series parameters', () => {
    const parser = new Parser('asPercent(#A, #B)');
    const rootNode = parser.getAst();
    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params[0].type).toBe('series-ref');
      expect(rootNode.params[0].value).toBe('#A');
      expect(rootNode.params[1].value).toBe('#B');
    }
  });

  it('series parameters, issue 2788', () => {
    const parser = new Parser("summarize(diffSeries(#A, #B), '10m', 'sum', false)");
    const rootNode = parser.getAst();

    if (rootNode && rootNode.params) {
      expect(rootNode.type).toBe('function');
      expect(rootNode.params[0].type).toBe('function');
      expect(rootNode.params[1].value).toBe('10m');
      expect(rootNode.params[3].type).toBe('bool');
    }
  });

  it('should parse metric expression with ip number segments', () => {
    const parser = new Parser('5.10.123.5');
    const rootNode = parser.getAst();

    if (rootNode && rootNode.segments) {
      expect(rootNode.segments[0].value).toBe('5');
      expect(rootNode.segments[1].value).toBe('10');
      expect(rootNode.segments[2].value).toBe('123');
      expect(rootNode.segments[3].value).toBe('5');
    }
  });
});
