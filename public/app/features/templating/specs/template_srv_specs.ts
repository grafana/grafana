import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import '../all';
import {Emitter} from 'app/core/core';

describe('templateSrv', function() {
  var _templateSrv, _variableSrv;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module($provide => {
    $provide.value('timeSrv', {});
  }));

  beforeEach(angularMocks.inject(function(variableSrv, templateSrv) {
    _templateSrv = templateSrv;
    _variableSrv = variableSrv;
  }));

  function initTemplateSrv(variables) {
    _variableSrv.init({
      templating: {list: variables},
      events: new Emitter(),
    });
  }

  describe('init', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: {value: 'oogle'}}]);
    });

    it('should initialize template data', function() {
      var target = _templateSrv.replace('this.[[test]].filters');
      expect(target).to.be('this.oogle.filters');
    });
  });

  describe('replace can pass scoped vars', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: {value: 'oogle' }}]);
    });

    it('should replace $test with scoped value', function() {
      var target = _templateSrv.replace('this.$test.filters', {'test': {value: 'mupp', text: 'asd'}});
      expect(target).to.be('this.mupp.filters');
    });

    it('should replace $test with scoped text', function() {
      var target = _templateSrv.replaceWithText('this.$test.filters', {'test': {value: 'mupp', text: 'asd'}});
      expect(target).to.be('this.asd.filters');
    });
  });

  describe('getAdhocFilters', function() {
    beforeEach(function() {
      initTemplateSrv([
        {type: 'datasource', name: 'ds', current: {value: 'logstash', text: 'logstash'}},
        {type: 'adhoc', name: 'test', datasource: 'oogle', filters: [1]},
        {type: 'adhoc', name: 'test2', datasource: '$ds', filters: [2]},
      ]);
    });

    it('should return filters if datasourceName match', function() {
      var filters = _templateSrv.getAdhocFilters('oogle');
      expect(filters).to.eql([1]);
    });

    it('should return empty array if datasourceName does not match', function() {
      var filters = _templateSrv.getAdhocFilters('oogleasdasd');
      expect(filters).to.eql([]);
    });

    it('should return filters when datasourceName match via data source variable', function() {
      var filters = _templateSrv.getAdhocFilters('logstash');
      expect(filters).to.eql([2]);
    });
  });

  describe('replace can pass multi / all format', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: {value: ['value1', 'value2'] }}]);
    });

    it('should replace $test with globbed value', function() {
      var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).to.be('this.{value1,value2}.filters');
    });

    it('should replace $test with piped value', function() {
      var target = _templateSrv.replace('this=$test', {}, 'pipe');
      expect(target).to.be('this=value1|value2');
    });

    it('should replace $test with piped value', function() {
      var target = _templateSrv.replace('this=$test', {}, 'pipe');
      expect(target).to.be('this=value1|value2');
    });
  });

  describe('variable with all option', function() {
    beforeEach(function() {
      initTemplateSrv([{
        type: 'query',
        name: 'test',
        current: {value: '$__all' },
        options: [
          {value: '$__all'}, {value: 'value1'}, {value: 'value2'}
        ]
      }]);
    });

    it('should replace $test with formatted all value', function() {
      var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).to.be('this.{value1,value2}.filters');
    });
  });

  describe('variable with all option and custom value', function() {
    beforeEach(function() {
      initTemplateSrv([{
        type: 'query',
        name: 'test',
        current: {value: '$__all' },
        allValue: '*',
        options: [
          {value: 'value1'}, {value: 'value2'}
        ]
      }]);
    });

    it('should replace $test with formatted all value', function() {
      var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).to.be('this.*.filters');
    });

    it('should not escape custom all value', function() {
      var target = _templateSrv.replace('this.$test', {}, 'regex');
      expect(target).to.be('this.*');
    });
  });

  describe('lucene format', function() {
    it('should properly escape $test with lucene escape sequences', function() {
      initTemplateSrv([{type: 'query', name: 'test', current: {value: 'value/4' }}]);
      var target = _templateSrv.replace('this:$test', {}, 'lucene');
      expect(target).to.be("this:value\\\/4");
    });
  });

  describe('format variable to string values', function() {
    it('single value should return value', function() {
      var result = _templateSrv.formatValue('test');
      expect(result).to.be('test');
    });

    it('multi value and glob format should render glob string', function() {
      var result = _templateSrv.formatValue(['test','test2'], 'glob');
      expect(result).to.be('{test,test2}');
    });

    it('multi value and lucene should render as lucene expr', function() {
      var result = _templateSrv.formatValue(['test','test2'], 'lucene');
      expect(result).to.be('("test" OR "test2")');
    });

    it('multi value and regex format should render regex string', function() {
      var result = _templateSrv.formatValue(['test.','test2'], 'regex');
      expect(result).to.be('(test\\.|test2)');
    });

    it('multi value and pipe should render pipe string', function() {
      var result = _templateSrv.formatValue(['test','test2'], 'pipe');
      expect(result).to.be('test|test2');
    });

    it('multi value and distributed should render distributed string', function() {
      var result = _templateSrv.formatValue(['test','test2'], 'distributed', { name: 'build' });
      expect(result).to.be('test,build=test2');
    });

    it('multi value and distributed should render when not string', function() {
      var result = _templateSrv.formatValue(['test'], 'distributed', { name: 'build' });
      expect(result).to.be('test');
    });

    it('slash should be properly escaped in regex format', function() {
      var result = _templateSrv.formatValue('Gi3/14', 'regex');
      expect(result).to.be('Gi3\\/14');
    });

  });

  describe('can check if variable exists', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should return true if exists', function() {
      var result = _templateSrv.variableExists('$test');
      expect(result).to.be(true);
    });
  });

  describe('can hightlight variables in string', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should insert html', function() {
      var result = _templateSrv.highlightVariablesAsHtml('$test');
      expect(result).to.be('<span class="template-variable">$test</span>');
    });

    it('should insert html anywhere in string', function() {
      var result = _templateSrv.highlightVariablesAsHtml('this $test ok');
      expect(result).to.be('this <span class="template-variable">$test</span> ok');
    });

    it('should ignore if variables does not exist', function() {
      var result = _templateSrv.highlightVariablesAsHtml('this $google ok');
      expect(result).to.be('this $google ok');
    });
  });

  describe('updateTemplateData with simple value', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: { value: 'muuuu' } }]);
    });

    it('should set current value and update template data', function() {
      var target = _templateSrv.replace('this.[[test]].filters');
      expect(target).to.be('this.muuuu.filters');
    });
  });

  describe('fillVariableValuesForUrl with multi value', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: { value: ['val1', 'val2'] }}]);
    });

    it('should set multiple url params', function() {
      var params = {};
      _templateSrv.fillVariableValuesForUrl(params);
      expect(params['var-test']).to.eql(['val1', 'val2']);
    });
  });

  describe('fillVariableValuesForUrl with multi value and scopedVars', function() {
    beforeEach(function() {
      initTemplateSrv([{type: 'query', name: 'test', current: { value: ['val1', 'val2'] }}]);
    });

    it('should set scoped value as url params', function() {
      var params = {};
      _templateSrv.fillVariableValuesForUrl(params, {'test': {value: 'val1'}});
      expect(params['var-test']).to.eql('val1');
    });
  });

  describe('replaceWithText', function() {
    beforeEach(function() {
      initTemplateSrv([
        {type: 'query', name: 'server', current: { value: '{asd,asd2}', text: 'All' } },
        {type: 'interval', name: 'period', current: { value: '$__auto_interval', text: 'auto' } }
      ]);
      _templateSrv.setGrafanaVariable('$__auto_interval', '13m');
      _templateSrv.updateTemplateData();
    });

    it('should replace with text except for grafanaVariables', function() {
      var target = _templateSrv.replaceWithText('Server: $server, period: $period');
      expect(target).to.be('Server: All, period: 13m');
    });
  });

  describe('built in interval variables', function() {
    beforeEach(function() {
      initTemplateSrv([]);
    });

    it('should replace $__interval_ms with interval milliseconds', function() {
      var target = _templateSrv.replace('10 * $__interval_ms', {"__interval_ms": {text: "100", value: "100"}});
      expect(target).to.be('10 * 100');
    });

  });
});
