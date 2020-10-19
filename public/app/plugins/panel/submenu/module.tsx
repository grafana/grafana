import { PanelPlugin } from '@grafana/data';

import { SubMenuPanel } from './SubMenuPanel';
import { SubMenuOptions } from './types';

export const plugin = new PanelPlugin<SubMenuOptions>(SubMenuPanel).setPanelOptions(builder => {
  builder
    .addTextInput({
      path: 'query',
      name: 'Query',
      description: 'Regular expression to select items to show',
      defaultValue: '',
    })
    .addBooleanSwitch({
      path: 'hideVariables',
      name: 'Hide Variables',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'hideAnnotations',
      name: 'Hide Annotations',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'hideLinks',
      name: 'Hide Links',
      defaultValue: false,
    });
});
