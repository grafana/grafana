import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import {Emitter} from 'app/core/core';

describe("Emitter", () => {

  describe('given 2 subscribers', () => {

    it('should notfiy subscribers', () => {
      var events = new Emitter();
      var sub1Called = false;
      var sub2Called = false;

      events.on('test', () => {
        sub1Called = true;
      });
      events.on('test', () => {
        sub2Called = true;
      });

      events.emit('test', null);

      expect(sub1Called).to.be(true);
      expect(sub2Called).to.be(true);
    });
  });

});


