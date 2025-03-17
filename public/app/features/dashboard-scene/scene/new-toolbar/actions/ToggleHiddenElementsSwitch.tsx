import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';

import { ToolbarSwitch } from '../ToolbarSwitch';
import { ToolbarActionProps } from '../types';

export const ToggleHiddenElementsSwitch = ({ dashboard }: ToolbarActionProps) => (
  <ToolbarSwitch
    icon="eye"
    label={t('dashboard.toolbar.new.toggle-hidden-elements', 'Toggle hidden elements')}
    checked={!!dashboard.state.showHiddenElements}
    variant="gray"
    data-testid={selectors.components.PageToolbar.itemButton('toggle_hidden_elements')}
    onClick={(evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      dashboard.onToggleHiddenElements();
    }}
  />
);
