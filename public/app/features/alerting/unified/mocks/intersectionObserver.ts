import { act } from 'test/test-utils';

interface Registration {
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  elements: Set<Element>;
}

/**
 * Replaces IntersectionObserver with one that reports nothing until the test says an observed element came
 * into view. The global mock in jest-setup.ts reports every element as in view on observe(), which would cause
 * runaway pagination for LoadMoreHelper.
 */
export function installControllableIntersectionObserver() {
  const original = global.IntersectionObserver;
  const registrations: Registration[] = [];

  global.IntersectionObserver = jest.fn().mockImplementation((callback: IntersectionObserverCallback) => {
    const registration: Registration = {
      callback,
      observer: null as unknown as IntersectionObserver,
      elements: new Set(),
    };
    registration.observer = {
      root: null,
      rootMargin: '',
      scrollMargin: '',
      thresholds: [],
      observe: (element: Element) => registration.elements.add(element),
      unobserve: (element: Element) => registration.elements.delete(element),
      disconnect: () => {
        registration.elements.clear();
        registrations.splice(registrations.indexOf(registration), 1);
      },
      takeRecords: () => [],
    };
    registrations.push(registration);
    return registration.observer;
  }) as unknown as typeof IntersectionObserver;

  const enter = (registration: Registration, element: Element) => {
    const rect = element.getBoundingClientRect();
    registration.callback(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: 0,
        },
      ],
      registration.observer
    );
  };

  return {
    /** Reports one observed element as in view. */
    enterNode: (element: Element) => {
      act(() => {
        registrations.filter((r) => r.elements.has(element)).forEach((r) => enter(r, element));
      });
    },
    /** Reports every currently observed element as in view, as when the end of the list is scrolled to. */
    intersectObserved: () => {
      act(() => {
        registrations.forEach((r) => [...r.elements].forEach((element) => enter(r, element)));
      });
    },
    restore: () => {
      global.IntersectionObserver = original;
    },
  };
}
