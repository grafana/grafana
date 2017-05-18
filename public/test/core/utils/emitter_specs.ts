import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

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

    it('when subscribing twice', () => {
      var events = new Emitter();
      var sub1Called = 0;

      function handler() {
        sub1Called += 1;
      }

      events.on('test', handler);
      events.on('test', handler);

      events.emit('test', null);

      expect(sub1Called).to.be(2);
    });

    it('should handle errors', () => {
      var events = new Emitter();
      var sub1Called = 0;
      var sub2Called = 0;

      events.on('test', () => {
        sub1Called++;
        throw "hello";
      });

      events.on('test', () => {
        sub2Called++;
      });

      try { events.emit('test', null); } catch (_) { }
      try { events.emit('test', null); } catch (_) {}

      expect(sub1Called).to.be(2);
      expect(sub2Called).to.be(0);
    });
  });
});


