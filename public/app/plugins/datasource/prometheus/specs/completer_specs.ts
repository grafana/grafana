import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {PromCompleter} from '../completer';
import {PrometheusDatasource} from '../datasource';

describe('Prometheus editor completer', function() {

  let editor = {};
  let session = {
    getTokenAt: sinon.stub().returns({}),
    getLine:  sinon.stub().returns(""),
  };

  let datasourceStub = <PrometheusDatasource>{};
  let completer = new PromCompleter(datasourceStub);

  describe("When inside brackets", () => {

    it("Should return range vectors", () => {
      completer.getCompletions(editor, session, 10, "[", (s, res) => {
        expect(res[0]).to.eql({caption: '1s', value: '[1s', meta: 'range vector'});
      });
    });

  });

});
