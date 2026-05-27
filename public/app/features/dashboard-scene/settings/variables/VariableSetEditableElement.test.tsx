import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, LocalValueVariable, SceneGridLayout, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { VariableList } from './VariableSetEditableElement';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    addVariableButtonClicked: jest.fn(),
  },
}));

const variables = new SceneVariableSet({ variables: [] });

export function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: variables,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

describe('VariableList', () => {
  describe('tracking add variable button', () => {
    it('should call DashboardInteractions.trackAddVariableButtonClicked with source edit_pane when onAdd is clicked in edit pane variable list', async () => {
      const user = userEvent.setup();
      buildTestScene();
      render(<VariableList set={variables} />);
      await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.addVariableButton));
      expect(DashboardInteractions.addVariableButtonClicked).toHaveBeenCalledWith({ source: 'edit_pane' });
    });
  });

  describe('section repeat local variables', () => {
    it('hides local repeat variable from row section variable list', () => {
      const set = new SceneVariableSet({
        variables: [
          new LocalValueVariable({ name: 'server', value: 'a', text: 'A' }),
          new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' }),
        ],
      });

      new RowItem({ $variables: set });

      render(<VariableList set={set} />);

      expect(screen.queryByText('$server')).not.toBeInTheDocument();
      expect(screen.queryByText('$env')).toBeInTheDocument();
    });

    it('hides local repeat variable from tab section variable list', () => {
      const set = new SceneVariableSet({
        variables: [
          new LocalValueVariable({ name: 'server', value: 'a', text: 'A' }),
          new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' }),
        ],
      });

      new TabItem({ $variables: set });

      render(<VariableList set={set} />);

      expect(screen.queryByText('$server')).not.toBeInTheDocument();
      expect(screen.queryByText('$env')).toBeInTheDocument();
    });
  });
});
