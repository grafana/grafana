import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';

import { ToolbarSwitch } from '../ToolbarSwitch';
import { ToolbarActionProps } from '../types';

export const HiddenElementsSwitch = ({ dashboard }: ToolbarActionProps) => (
  <ToolbarSwitch
    checked={!dashboard.state.showHiddenElements}
    icon="eye"
    label={t('dashboard.toolbar.new.hidden-elements.unchecked', 'Hide hidden elements')}
    checkedIcon="eye-slash"
    checkedLabel={t('dashboard.toolbar.new.hidden-elements.checked', 'Show hidden elements')}
    data-testid={selectors.components.PageToolbar.itemButton('hidden_elements')}
    onClick={(evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      dashboard.onToggleHiddenElements();
    }}
  />
);
