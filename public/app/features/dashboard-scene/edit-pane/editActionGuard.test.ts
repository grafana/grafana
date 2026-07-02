import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { DashboardUI, runWithinEditAction } from './editActionGuard';

@DashboardUI
class GuardedObject extends SceneObjectBase<SceneObjectState> {}

class UnguardedObject extends SceneObjectBase<SceneObjectState> {}

describe('editActionGuard', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when a @DashboardUI object setState is called outside an edit action', () => {
    const obj = new GuardedObject({});

    obj.setState({ key: 'a' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('GuardedObject.setState was called outside of a Dashboard Edit Action');
  });

  it('does not warn when setState runs within runWithinEditAction', () => {
    const obj = new GuardedObject({});

    runWithinEditAction(() => obj.setState({ key: 'b' }));

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still applies the state change (the guard only observes)', () => {
    const obj = new GuardedObject({});

    obj.setState({ key: 'c' });

    expect(obj.state.key).toBe('c');
  });

  it('handles nested/batched edit actions (re-entrant marker)', () => {
    const obj = new GuardedObject({});

    runWithinEditAction(() => {
      runWithinEditAction(() => obj.setState({ key: 'inner' }));
      // Still inside the outer action after the inner one finishes.
      obj.setState({ key: 'outer' });
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not affect scene objects without the decorator', () => {
    const obj = new UnguardedObject({});

    obj.setState({ key: 'd' });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(obj.state.key).toBe('d');
  });

  it('can be applied at runtime (e.g. to library classes) and guards existing instances', () => {
    class RuntimeGuarded extends SceneObjectBase<SceneObjectState> {}

    // Instance created before the guard is applied is still covered (prototype patch).
    const obj = new RuntimeGuarded({});

    DashboardUI(RuntimeGuarded);

    obj.setState({ key: 'a' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — applying it more than once does not warn multiple times', () => {
    class AppliedTwice extends SceneObjectBase<SceneObjectState> {}

    DashboardUI(AppliedTwice);
    DashboardUI(AppliedTwice);

    new AppliedTwice({}).setState({ key: 'a' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
