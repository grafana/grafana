import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneVariableSet, ScopesVariable, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { ConditionalRenderingVariable } from '../conditions/ConditionalRenderingVariable';

import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';

function buildScene(variables: SceneVariable[]) {
  const model = ConditionalRenderingGroup.createEmpty();

  const row = new RowItem({
    conditionalRendering: model,
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    $variables: new SceneVariableSet({ variables }),
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return model;
}

function buildSceneWithCondition(variables: SceneVariable[], condition: ConditionalRenderingVariable) {
  const model = new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [condition],
    result: true,
    renderHidden: false,
  });

  const row = new RowItem({
    conditionalRendering: model,
    layout: AutoGridLayoutManager.createEmpty(),
  });

  new DashboardScene({
    $variables: new SceneVariableSet({ variables }),
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return model;
}

describe('ConditionalRenderingGroupRenderer', () => {
  describe('variables list filtering', () => {
    it('does not create a variable condition when only system variables are present', async () => {
      const user = userEvent.setup();
      const model = buildScene([new ScopesVariable({ enable: true })]);
      const createConditionSpy = jest.spyOn(model, 'createCondition');

      render(<ConditionalRenderingGroup.Component model={model} />);

      await user.click(screen.getByRole('button', { name: /add rule/i }));
      await user.click(await screen.findByText('Template variable'));

      expect(createConditionSpy).not.toHaveBeenCalled();
    });

    it('creates a variable condition when a user-defined variable is present', async () => {
      const user = userEvent.setup();
      const model = buildScene([new CustomVariable({ name: 'myVar', query: 'a,b' })]);
      const createConditionSpy = jest.spyOn(model, 'createCondition');

      render(<ConditionalRenderingGroup.Component model={model} />);

      await user.click(screen.getByRole('button', { name: /add rule/i }));
      await user.click(await screen.findByText('Template variable'));

      expect(createConditionSpy).toHaveBeenCalledWith('variable');
    });

    it('creates a variable condition when both system and user-defined variables are present', async () => {
      const user = userEvent.setup();
      const model = buildScene([
        new ScopesVariable({ enable: true }),
        new CustomVariable({ name: 'myVar', query: 'a,b' }),
      ]);
      const createConditionSpy = jest.spyOn(model, 'createCondition');

      render(<ConditionalRenderingGroup.Component model={model} />);

      await user.click(screen.getByRole('button', { name: /add rule/i }));
      await user.click(await screen.findByText('Template variable'));

      expect(createConditionSpy).toHaveBeenCalledWith('variable');
    });
  });

  describe('createCondition variable default', () => {
    it('uses the first user-defined variable as the default variable name', () => {
      const model = buildScene([new CustomVariable({ name: 'myVar', query: 'a,b' })]);

      const condition = model.createCondition('variable');

      expect(condition).toBeInstanceOf(ConditionalRenderingVariable);
      expect((condition as ConditionalRenderingVariable).state.variable).toBe('myVar');
    });

    it('skips system variables (ScopesVariable) when choosing the default variable name', () => {
      const model = buildScene([
        new ScopesVariable({ enable: true }),
        new CustomVariable({ name: 'userVar', query: 'a,b' }),
      ]);

      const condition = model.createCondition('variable');

      expect(condition).toBeInstanceOf(ConditionalRenderingVariable);
      expect((condition as ConditionalRenderingVariable).state.variable).toBe('userVar');
    });

    it('defaults to an empty variable name when only system variables are present', () => {
      const model = buildScene([new ScopesVariable({ enable: true })]);

      const condition = model.createCondition('variable');

      expect(condition).toBeInstanceOf(ConditionalRenderingVariable);
      expect((condition as ConditionalRenderingVariable).state.variable).toBe('');
    });
  });

  describe('variable name options in the variable condition Combobox', () => {
    beforeAll(() => {
      comboboxTestSetup();
    });

    it('lists only user-defined variables — not system variables — as selectable options', async () => {
      const user = userEvent.setup({ applyAccept: false });

      const condition = ConditionalRenderingVariable.createEmpty('myVar');
      const model = buildSceneWithCondition(
        [new ScopesVariable({ name: '__scopes', enable: true }), new CustomVariable({ name: 'myVar', query: 'a,b' })],
        condition
      );

      render(<ConditionalRenderingGroup.Component model={model} />);

      await user.click(
        screen.getByTestId(selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.variableSelection)
      );

      expect(await screen.findByRole('option', { name: 'myVar' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '__scopes' })).not.toBeInTheDocument();
    });
  });
});
