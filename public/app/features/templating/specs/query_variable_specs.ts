import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {QueryVariable} from '../query_variable';

describe('QueryVariable', () => {

  describe('when creating from model', () => {

    it('should set defaults', () => {
      var variable = new QueryVariable({}, null, null, null, null, null);
      expect(variable.datasource).to.be(null);
      expect(variable.refresh).to.be(0);
      expect(variable.sort).to.be(0);
      expect(variable.name).to.be('');
      expect(variable.hide).to.be(0);
      expect(variable.options.length).to.be(0);
      expect(variable.multi).to.be(false);
      expect(variable.includeAll).to.be(false);
    });

    it('get model should copy changes back to model', () => {
      var variable = new QueryVariable({}, null, null, null, null, null);
      variable.options = [{text: 'test'}];
      variable.datasource = 'google';
      variable.regex = 'asd';
      variable.sort = 50;

      var model = variable.getSaveModel();
      expect(model.options.length).to.be(1);
      expect(model.options[0].text).to.be('test');
      expect(model.datasource).to.be('google');
      expect(model.regex).to.be('asd');
      expect(model.sort).to.be(50);
    });

    it('if refresh != 0 then remove options in presisted mode', () => {
      var variable = new QueryVariable({}, null, null, null, null, null);
      variable.options = [{text: 'test'}];
      variable.refresh = 1;

      var model = variable.getSaveModel();
      expect(model.options.length).to.be(0);
    });
  });

  describe('can convert and sort metric names',() => {
    var variable = new QueryVariable({}, null, null, null, null, null);
    variable.sort = 3; // Numerical (asc)

    describe('can sort a mixed array of metric variables', () => {
      var input = [
        {text: '0', value: '0'},
        {text: '1', value: '1'},
        {text: null, value: 3},
        {text: undefined, value: 4},
        {text: '5', value: null},
        {text: '6', value: undefined},
        {text: null, value: '7'},
        {text: undefined, value: '8'},
        {text: 9, value: null},
        {text: 10, value: undefined},
        {text: '', value: undefined},
        {text: undefined, value: ''},
      ];

      var result = variable.metricNamesToVariableValues(input);
      it('should return in same order', () => {
        var i = 0;

        expect(result.length).to.be(11);
        expect(result[i++].text).to.be('');
        expect(result[i++].text).to.be('0');
        expect(result[i++].text).to.be('1');
        expect(result[i++].text).to.be('3');
        expect(result[i++].text).to.be('4');
        expect(result[i++].text).to.be('5');
        expect(result[i++].text).to.be('6');
      });
    });
  });
});

