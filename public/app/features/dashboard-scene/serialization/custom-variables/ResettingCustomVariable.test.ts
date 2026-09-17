import { EmbeddedScene, SceneFlexLayout, SceneVariableSet, TextBoxVariable } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';

import { ResettingCustomVariable } from './ResettingCustomVariable';

function sceneWithVariables(variables: Array<TextBoxVariable | ResettingCustomVariable>) {
  return new EmbeddedScene({
    $variables: new SceneVariableSet({ variables }),
    body: new SceneFlexLayout({ children: [] }),
  });
}

// The reset is deferred by one microtask so it lands after the state-change notification
// that triggered it (see ResettingCustomVariable for why), so assertions on a reset need
// to yield first.
const flushReset = () => Promise.resolve();

describe('ResettingCustomVariable', () => {
  it('resets to empty when a dependency that had already resolved a value clears at runtime', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));

    expect(target.state.value).toBe('scopeA');

    dep.setValue('');
    await flushReset();

    expect(target.state.value).toBe('');
    expect(target.state.text).toBe('');

    deactivate();
  });

  it('does not reset synchronously, so a pending URL write can land first', () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    dep.setValue('');

    // Still the old value in the same tick — this is what stops ScopesService's URL
    // listener from seeing a var-<name> write while a stale scopes param is present.
    expect(target.state.value).toBe('scopeA');

    deactivate();
  });

  it('keeps a value reassigned in the same tick as a clear, rather than the superseded reset', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    // Clear and reassign before the deferred reset can land. The clear must not leave a
    // guard set that reverts the reassignment, and its stale empty result must not win.
    dep.setValue('');
    dep.setValue('scopeB');
    await flushReset();

    expect(target.state.value).toBe('scopeB');

    deactivate();
  });

  it('protects a URL-set value across repeated empty resolutions', async () => {
    const target = new ResettingCustomVariable({ name: 'target', query: '' });

    // Simulate what MultiValueUrlSyncHandler.updateFromUrl does while inactive: set the
    // upstream flag and the value together, before any real resolution has happened.
    target.skipNextValidation = true;
    target.changeValueTo('urlValue', 'urlValue');

    // Flushing matters. Asserting in the same tick would pass even if this variable were
    // wrongly routed through the deferred reset, because the clobber lands a microtask later.
    target.validateAndUpdate().subscribe();
    await flushReset();
    expect(target.state.value).toBe('urlValue');

    target.validateAndUpdate().subscribe();
    await flushReset();
    expect(target.state.value).toBe('urlValue');
  });

  it('drops a pending reset when the query is edited to drop its dependency', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    // Schedule a reset, then make the query static before it lands. The pending reset is
    // now for a query that no longer exists and must not overwrite the static resolution.
    dep.setValue('');
    target.setState({ query: 'a,b' });
    target.validateAndUpdate().subscribe();
    await flushReset();

    expect(target.state.value).toBe('a');

    deactivate();
  });

  it('still resets on a clone, which keeps the query and so keeps the dependency', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    // Panel edit, duplication, and repeats all clone. The clone must behave the same, so
    // the signal driving the override has to be state rather than an instance field.
    const clone = target.clone();
    const cloneDep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const deactivateClone = activateFullSceneTree(sceneWithVariables([cloneDep, clone]));
    expect(clone.state.value).toBe('scopeA');

    cloneDep.setValue('');
    await flushReset();

    expect(clone.state.value).toBe('');

    deactivateClone();
    deactivate();
  });

  it('leaves a static query alone, so the URL-value protection it relies on still applies', async () => {
    // The scenes#1027 case: no variable references, so zero options is not a cleared
    // dependency and the upstream guard must keep protecting the URL value.
    const target = new ResettingCustomVariable({ name: 'target', query: '' });
    expect(target.variableDependency?.getNames().size).toBe(0);

    target.skipNextValidation = true;
    target.changeValueTo('urlValue', 'urlValue');
    target.validateAndUpdate().subscribe();
    await flushReset();

    expect(target.state.value).toBe('urlValue');
  });

  it('resolves an includeAll variable to "All" rather than empty when a dependency clears', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({
      name: 'target',
      query: '${dep}',
      // Seed a value matching the first resolution: defaultToAll only kicks in when the
      // current value doesn't match any resolved option, so an unmatched initial value
      // would resolve to "All" on the very first pass regardless of this fix.
      value: 'scopeA',
      text: 'scopeA',
      includeAll: true,
      defaultToAll: true,
    });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    dep.setValue('');
    await flushReset();

    expect(target.state.value).toBe('$__all');
    expect(target.state.text).toBe('All');

    deactivate();
  });
});
