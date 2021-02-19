import { Emitter } from '../utils/emitter';
import { eventFactory } from '@grafana/data';

const testEvent = eventFactory('test');

describe('Emitter', () => {
  describe('given 2 subscribers', () => {
    it('should notfiy subscribers', () => {
      const events = new Emitter();
      let sub1Called = false;
      let sub2Called = false;

      events.on(testEvent, () => {
        sub1Called = true;
      });
      events.on(testEvent, () => {
        sub2Called = true;
      });

      events.emit(testEvent, null);

      expect(sub1Called).toBe(true);
      expect(sub2Called).toBe(true);
    });

    it('when subscribing twice', () => {
      const events = new Emitter();
      let sub1Called = 0;

      function handler() {
        sub1Called += 1;
      }

      events.on(testEvent, handler);
      events.on(testEvent, handler);

      events.emit(testEvent, null);

      expect(sub1Called).toBe(2);
    });

    it('should handle errors', () => {
      const events = new Emitter();
      let sub1Called = 0;
      let sub2Called = 0;

      events.on(testEvent, () => {
        sub1Called++;
        throw { message: 'hello' };
      });

      events.on(testEvent, () => {
        sub2Called++;
      });

      try {
        events.emit(testEvent, null);
      } catch (_) {}
      try {
        events.emit(testEvent, null);
      } catch (_) {}

      expect(sub1Called).toBe(2);
      expect(sub2Called).toBe(0);
    });
  });
});
