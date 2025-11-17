import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { SceneVariable, SceneVariableState, TestVariable } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';

import { VariableEditorList } from './VariableEditorList';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    addVariableButtonClicked: jest.fn(),
  },
}));

const setup = (variables: Array<SceneVariable<SceneVariableState>> = []) => {
  return render(
    <VariableEditorList
      variables={variables}
      usages={[]}
      usagesNetwork={[]}
      onAdd={jest.fn()}
      onChangeOrder={jest.fn()}
      onDuplicate={jest.fn()}
      onDelete={jest.fn()}
      onEdit={jest.fn()}
    />
  );
};
describe('VariableEditorList', () => {
  describe('tracking add variable button', () => {
    it('should call DashboardInteractions.trackAddVariableButtonClicked with source settings_pane when onAdd is clicked in empty variable list', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add variable')));
      expect(DashboardInteractions.addVariableButtonClicked).toHaveBeenCalledWith({ source: 'settings_pane' });
    });
    it('should call DashboardInteractions.trackAddVariableButtonClicked with source settings_pane when onAdd is clicked in variable list', async () => {
      const user = userEvent.setup();
      const variables = [
        new TestVariable({ name: 'Renamed Variable', query: 'A.*', value: '', text: '', options: [] }),
      ];
      setup(variables);
      await user.click(screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.newButton));
      expect(DashboardInteractions.addVariableButtonClicked).toHaveBeenCalledWith({ source: 'settings_pane' });
    });
  });
});
