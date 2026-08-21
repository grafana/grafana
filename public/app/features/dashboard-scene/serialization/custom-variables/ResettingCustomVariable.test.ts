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

  it('protects a URL-set value across multiple consecutive empty resolutions before anything has resolved', () => {
    const target = new ResettingCustomVariable({ name: 'target', query: '' });

    // Simulate what MultiValueUrlSyncHandler.updateFromUrl does while inactive: set the
    // upstream flag and the value together, before any real resolution has happened.
    target.skipNextValidation = true;
    target.changeValueTo('urlValue', 'urlValue');

    target.validateAndUpdate().subscribe();
    expect(target.state.value).toBe('urlValue');

    // A second consecutive empty resolution — the case where a flag consumed on the
    // first pass would fail to protect the value, but the latch still does.
    target.validateAndUpdate().subscribe();
    expect(target.state.value).toBe('urlValue');
  });

  it('keeps the latch tripped on a clone, unlike an instance field would', async () => {
    const dep = new TextBoxVariable({ name: 'dep', value: 'scopeA' });
    const target = new ResettingCustomVariable({ name: 'target', query: '${dep}' });

    const deactivate = activateFullSceneTree(sceneWithVariables([dep, target]));
    expect(target.state.value).toBe('scopeA');

    const clone = target.clone({ query: '' });
    clone.validateAndUpdate().subscribe();
    await flushReset();

    expect(clone.state.value).toBe('');

    deactivate();
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
