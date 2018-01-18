import { Emitter } from '../utils/emitter';

describe('Emitter', () => {
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

      expect(sub1Called).toBe(true);
      expect(sub2Called).toBe(true);
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

      expect(sub1Called).toBe(2);
    });

    it('should handle errors', () => {
      var events = new Emitter();
      var sub1Called = 0;
      var sub2Called = 0;

      events.on('test', () => {
        sub1Called++;
        throw { message: 'hello' };
      });

      events.on('test', () => {
        sub2Called++;
      });

      try {
        events.emit('test', null);
      } catch (_) {}
      try {
        events.emit('test', null);
      } catch (_) {}

      expect(sub1Called).toBe(2);
      expect(sub2Called).toBe(0);
    });
  });
});
