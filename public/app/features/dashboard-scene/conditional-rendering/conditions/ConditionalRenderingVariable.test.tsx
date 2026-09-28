import { CustomVariable, SceneVariableSet, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

function buildScene(variable: SceneVariable, condition: ConditionalRenderingVariable) {
  const group = new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [condition],
    result: true,
    renderHidden: false,
  });

  const row = new RowItem({
    conditionalRendering: group,
    layout: AutoGridLayoutManager.createEmpty(),
  });

  const scene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: new RowsLayoutManager({ rows: [row] }),
  });

  activateFullSceneTree(scene);

  return condition;
}

describe('ConditionalRenderingVariable regex matching', () => {
  it('matches using the RE2-style (?i) inline case-insensitivity flag', () => {
    const variable = new CustomVariable({ name: 'env', query: 'PROD', value: 'PROD', text: 'PROD' });
    const condition = new ConditionalRenderingVariable({
      variable: 'env',
      operator: '=~',
      value: '(?i)prod',
      result: undefined,
    });

    buildScene(variable, condition);

    expect(condition.state.result).toBe(true);
  });

  it('does not match a non-matching (?i) pattern instead of erroring out', () => {
    const variable = new CustomVariable({ name: 'env', query: 'PROD', value: 'PROD', text: 'PROD' });
    const condition = new ConditionalRenderingVariable({
      variable: 'env',
      operator: '=~',
      value: '(?i)staging',
      result: undefined,
    });

    buildScene(variable, condition);

    // Before (?i) was supported, the invalid-in-JS pattern threw and the catch
    // block fell back to `true`, wrongly showing the object.
    expect(condition.state.result).toBe(false);
  });

  it('evaluates a plain regex without inline flags case-sensitively', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod', value: 'prod', text: 'prod' });
    const condition = new ConditionalRenderingVariable({
      variable: 'env',
      operator: '=~',
      value: 'PROD',
      result: undefined,
    });

    buildScene(variable, condition);

    expect(condition.state.result).toBe(false);
  });
});
