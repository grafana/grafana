import { CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { getEditableElementFor } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { type EditableDashboardElement } from '../../scene/types/EditableDashboardElement';
import { toControlSourceRef } from '../../utils/predefinedVariables';
import { activateFullSceneTree } from '../../utils/test-utils';

import { ProvisionedVariableEditableElement } from './ProvisionedVariableEditableElement';

describe('ProvisionedVariableEditableElement', () => {
  it('does not expose delete or duplicate actions', () => {
    const variable = new CustomVariable({
      name: 'globalVar',
      query: 'a,b',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const element: EditableDashboardElement = new ProvisionedVariableEditableElement(variable);

    expect(element.onDelete).toBeUndefined();
    expect(element.onConfirmDelete).toBeUndefined();
    expect(element.onDuplicate).toBeUndefined();
    expect(element.renderActions).toBeUndefined();
  });

  it('is returned from getEditableElementFor for variables with origin', () => {
    const variable = new CustomVariable({
      name: 'globalVar',
      query: 'a,b',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
    });
    activateFullSceneTree(dashboard);

    const element = getEditableElementFor(variable);
    expect(element).toBeInstanceOf(ProvisionedVariableEditableElement);
  });
});
