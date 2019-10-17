import { Subject } from 'rxjs';
import { act, renderHook } from 'react-hooks-testing-library';
import { AppEvent, eventFactory } from '@grafana/data';

import { useEventing } from './useEventing';

describe('useEventing', () => {
  describe('when initialized', () => {
    it('then it should return correct object', () => {
      const events = new Subject<AppEvent<any>>();
      const publish = jest.fn();
      const { result } = renderHook(() => useEventing({ events, publish }));

      expect(result.current.publishEvent).toBeDefined();
      expect(result.current.subscribeToEvents).toBeDefined();
    });
  });

  describe('when publishing events filter returns true', () => {
    it('then it should call tap and filter on each subscriber', () => {
      const events = new Subject<AppEvent<any>>();
      const publish = (event: any) => events.next(event);
      const tap = jest.fn();
      const filter = jest.fn().mockReturnValue(true);
      const event = eventFactory<string>('event1');
      const origin = 'origin1';
      const payload = 'payload1';
      const { result } = renderHook(() => useEventing({ events, publish }));

      act(() => result.current.subscribeToEvents({ tap, filter }));
      act(() => result.current.subscribeToEvents({ tap, filter }));
      act(() => result.current.publishEvent({ event, origin, payload }));

      expect(tap).toBeCalledTimes(2);
      expect(tap).toBeCalledWith({ ...event, origin, payload });
      expect(filter).toBeCalledTimes(2);
      expect(filter).toBeCalledWith({ ...event, origin, payload });
    });
  });

  describe('when publishing events filter returns false', () => {
    it('then it should call filter but not tap on each subscriber', () => {
      const events = new Subject<AppEvent<any>>();
      const publish = (event: any) => events.next(event);
      const tap = jest.fn();
      const filter = jest.fn().mockReturnValue(false);
      const event = eventFactory<string>('event2');
      const origin = 'origin2';
      const payload = 'payload2';
      const { result } = renderHook(() => useEventing({ events, publish }));

      act(() => result.current.subscribeToEvents({ tap, filter }));
      act(() => result.current.subscribeToEvents({ tap, filter }));
      act(() => result.current.publishEvent({ event, origin, payload }));

      expect(tap).toBeCalledTimes(0);
      expect(filter).toBeCalledTimes(2);
      expect(filter).toBeCalledWith({ ...event, origin, payload });
    });
  });

  describe('when subscribing and then unmounting', () => {
    it('then it should unsubscribe from events', () => {
      const events = new Subject<AppEvent<any>>();
      const publish = jest.fn();
      const { result, unmount } = renderHook(() => useEventing({ events, publish }));
      const tap = jest.fn();
      const filter = jest.fn();

      act(() => result.current.subscribeToEvents({ tap, filter }));
      act(() => result.current.subscribeToEvents({ tap, filter }));

      expect(events.observers.length).toBe(2);

      unmount();

      expect(events.observers.length).toBe(0);
    });
  });
});
