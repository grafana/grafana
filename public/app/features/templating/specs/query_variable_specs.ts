import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {QueryVariable} from '../query_variable';

describe('QueryVariable', function() {

  describe('when creating from model', function() {

    it('should set defaults', function() {
      var variable = new QueryVariable({}, null, null, null, null);
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
      var variable = new QueryVariable({}, null, null, null, null);
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
      var variable = new QueryVariable({}, null, null, null, null);
      variable.options = [{text: 'test'}];
      variable.refresh = 1;

      var model = variable.getSaveModel();
      expect(model.options.length).to.be(0);
    });
  });
});

