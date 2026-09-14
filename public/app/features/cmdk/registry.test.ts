import { CmdkSourceRegistry } from './registry';
import { type CmdkSource } from './types';

function makeSource(): CmdkSource {
  return {
    query: async () => [],
    providedSections: [],
  };
}

describe('CmdkSourceRegistry', () => {
  it('registers sources and returns an unregister function', () => {
    const registry = new CmdkSourceRegistry();
    const source = makeSource();

    const unregister = registry.register(source);
    expect(registry.getSources()).toEqual([source]);

    unregister();
    expect(registry.getSources()).toEqual([]);
  });

  it('notifies subscribers on register and unregister', () => {
    const registry = new CmdkSourceRegistry();
    const listener = jest.fn();
    registry.subscribe(listener);

    const unregister = registry.register(makeSource());
    expect(listener).toHaveBeenCalledTimes(1);

    unregister();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const registry = new CmdkSourceRegistry();
    const listener = jest.fn();
    const unsubscribe = registry.subscribe(listener);

    unsubscribe();
    registry.register(makeSource());
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the snapshot reference stable between changes', () => {
    const registry = new CmdkSourceRegistry();
    registry.register(makeSource());

    expect(registry.getSources()).toBe(registry.getSources());
  });
});
