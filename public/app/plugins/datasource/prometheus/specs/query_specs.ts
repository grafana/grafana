import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {PromQuery} from '../prom_query';

describe.only('PromQuery', function() {
  var templateSrv = {replace: val => val};

  describe('render series with mesurement only', function() {
    it('should generate correct query', function() {
      var query = new PromQuery({
        metric: 'cpu',
        range: '5m',
        functions: [
          {type: 'rate', params: []}
        ]
      }, templateSrv, {});

      var queryText = query.render();
      expect(queryText).to.be('rate(cpu[5m])');
    });
  });

});
