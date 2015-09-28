define([
  'app/plugins/datasource/graphite/lexer'
], function(Lexer) {
  'use strict';

  describe('when lexing graphite expression', function() {

    it('should tokenize metric expression', function() {
      var lexer = new Lexer('metric.test.*.asd.count');
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('metric');
      expect(tokens[1].value).to.be('.');
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[4].type).to.be('identifier');
      expect(tokens[4].pos).to.be(13);
    });

    it('should tokenize metric expression with dash', function() {
      var lexer = new Lexer('metric.test.se1-server-*.asd.count');
      var tokens = lexer.tokenize();
      expect(tokens[4].type).to.be('identifier');
      expect(tokens[4].value).to.be('se1-server-*');
    });

    it('should tokenize metric expression with dash2', function() {
      var lexer = new Lexer('net.192-168-1-1.192-168-1-9.ping_value.*');
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('net');
      expect(tokens[2].value).to.be('192-168-1-1');
    });

    it('should tokenize metric expression with equal sign', function() {
      var lexer = new Lexer('apps=test');
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('apps=test');
    });

    it('simple function2', function() {
      var lexer = new Lexer('offset(test.metric, -100)');
      var tokens = lexer.tokenize();
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[4].type).to.be('identifier');
      expect(tokens[6].type).to.be('number');
    });

    it('should tokenize metric expression with curly braces', function() {
      var lexer = new Lexer('metric.se1-{first, second}.count');
      var tokens = lexer.tokenize();
      expect(tokens.length).to.be(10);
      expect(tokens[3].type).to.be('{');
      expect(tokens[4].value).to.be('first');
      expect(tokens[5].value).to.be(',');
      expect(tokens[6].value).to.be('second');
    });

    it('should tokenize metric expression with number segments', function() {
      var lexer = new Lexer("metric.10.12_10.test");
      var tokens = lexer.tokenize();
      expect(tokens[0].type).to.be('identifier');
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[2].value).to.be('10');
      expect(tokens[4].value).to.be('12_10');
      expect(tokens[4].type).to.be('identifier');
    });

    it('should tokenize func call with numbered metric and number arg', function() {
      var lexer = new Lexer("scale(metric.10, 15)");
      var tokens = lexer.tokenize();
      expect(tokens[0].type).to.be('identifier');
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[2].value).to.be('metric');
      expect(tokens[4].value).to.be('10');
      expect(tokens[4].type).to.be('number');
      expect(tokens[6].type).to.be('number');
    });

    it('should tokenize metric with template parameter', function() {
      var lexer = new Lexer("metric.[[server]].test");
      var tokens = lexer.tokenize();
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[2].value).to.be('[[server]]');
      expect(tokens[4].type).to.be('identifier');
    });

    it('should tokenize metric with question mark', function() {
      var lexer = new Lexer("metric.server_??.test");
      var tokens = lexer.tokenize();
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[2].value).to.be('server_??');
      expect(tokens[4].type).to.be('identifier');
    });

    it('should handle error with unterminated string', function() {
      var lexer = new Lexer("alias(metric, 'asd)");
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('alias');
      expect(tokens[1].value).to.be('(');
      expect(tokens[2].value).to.be('metric');
      expect(tokens[3].value).to.be(',');
      expect(tokens[4].type).to.be('string');
      expect(tokens[4].isUnclosed).to.be(true);
      expect(tokens[4].pos).to.be(20);
    });

    it('should handle float parameters', function() {
      var lexer = new Lexer("alias(metric, 0.002)");
      var tokens = lexer.tokenize();
      expect(tokens[4].type).to.be('number');
      expect(tokens[4].value).to.be('0.002');
    });

    it('should handle bool parameters', function() {
      var lexer = new Lexer("alias(metric, true, false)");
      var tokens = lexer.tokenize();
      expect(tokens[4].type).to.be('bool');
      expect(tokens[4].value).to.be('true');
      expect(tokens[6].type).to.be('bool');
    });

  });

});
