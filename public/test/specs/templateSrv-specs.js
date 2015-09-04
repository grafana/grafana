define([
  'mocks/dashboard-mock',
  'lodash',
  'features/templating/templateSrv'
], function(dashboardMock) {
  'use strict';

  describe('templateSrv', function() {
    var _templateSrv;
    var _dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(module(function() {
      _dashboard = dashboardMock.create();
    }));

    beforeEach(inject(function(templateSrv) {
      _templateSrv = templateSrv;
    }));

    describe('init', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'oogle' } }]);
      });

      it('should initialize template data', function() {
        var target = _templateSrv.replace('this.[[test]].filters');
        expect(target).to.be('this.oogle.filters');
      });
    });

    describe('replace can pass scoped vars', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'oogle' } }]);
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

    describe('render variable to string values', function() {
      it('single value should return value', function() {
        var result = _templateSrv.renderVariableValue({current: {value: 'test'}});
        expect(result).to.be('test');
      });

      it('multi value and glob format should render glob string', function() {
        var result = _templateSrv.renderVariableValue({
          multiFormat: 'glob',
          current: {
            value: ['test','test2'],
          }
        });
        expect(result).to.be('{test,test2}');
      });

      it('multi value and regex format should render regex string', function() {
        var result = _templateSrv.renderVariableValue({
          multiFormat: 'regex values',
          current: {
            value: ['test','test2'],
          }
        });
        expect(result).to.be('(test|test2)');
      });

      it('multi value and pipe delimited format should render regex string', function() {
        var result = _templateSrv.renderVariableValue({
          multiFormat: 'pipe delimited',
          current: {
            value: ['test','test2'],
          }
        });
        expect(result).to.be('test|test2');
      });


    });

    describe('can check if variable exists', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'oogle' } }]);
      });

      it('should return true if exists', function() {
        var result = _templateSrv.variableExists('$test');
        expect(result).to.be(true);
      });
    });

    describe('can hightlight variables in string', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'oogle' } }]);
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

    describe('when checking if a string contains a variable', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'muuuu' } }]);
      });

      it('should find it with $var syntax', function() {
        var contains = _templateSrv.containsVariable('this.$test.filters', 'test');
        expect(contains).to.be(true);
      });

      it('should find it with [[var]] syntax', function() {
        var contains = _templateSrv.containsVariable('this.[[test]].filters', 'test');
        expect(contains).to.be(true);
      });

    });

    describe('updateTemplateData with simple value', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'muuuu' } }]);
      });

      it('should set current value and update template data', function() {
        var target = _templateSrv.replace('this.[[test]].filters');
        expect(target).to.be('this.muuuu.filters');
      });
    });

    describe('fillVariableValuesForUrl with multi value', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: ['val1', 'val2'] }}]);
      });

      it('should set multiple url params', function() {
        var params = {};
        _templateSrv.fillVariableValuesForUrl(params);
        expect(params['var-test']).to.eql(['val1', 'val2']);
      });
    });

    describe('fillVariableValuesForUrl with multi value and scopedVars', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: ['val1', 'val2'] }}]);
      });

      it('should set multiple url params', function() {
        var params = {};
        _templateSrv.fillVariableValuesForUrl(params, {'test': {value: 'val1'}});
        expect(params['var-test']).to.eql('val1');
      });
    });

    describe('replaceWithText', function() {
      beforeEach(function() {
        _templateSrv.init([
          { name: 'server', current: { value: '{asd,asd2}', text: 'All' } },
          { name: 'period', current: { value: '$__auto_interval', text: 'auto' } }
        ]);
        _templateSrv.setGrafanaVariable('$__auto_interval', '13m');
        _templateSrv.updateTemplateData();
      });

      it('should replace with text except for grafanaVariables', function() {
        var target = _templateSrv.replaceWithText('Server: $server, period: $period');
        expect(target).to.be('Server: All, period: 13m');
      });
    });


  });

});
