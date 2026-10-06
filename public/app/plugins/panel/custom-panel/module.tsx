import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { CustomPanel } from './CustomPanel';
import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { customPanelChangeHandler } from './migrations';
import { getDefaultDrawingCode } from './templates';
import { type Options } from './types';

export const plugin = new PanelPlugin<Options>(CustomPanel)
  .setNoPadding()
  .setFitContentSupport()
  .setPanelChangeHandler(customPanelChangeHandler)
  .setPanelOptions((builder) => {
    builder.addCustomEditor({
      id: 'code',
      path: 'code',
      name: t('custom-panel.options.code', 'Drawing code'),
      description: t(
        'custom-panel.options.code-description',
        'JavaScript that draws the panel data. It is stored in the dashboard and runs in a sandbox.'
      ),
      editor: CustomPanelCodeEditor,
      defaultValue: getDefaultDrawingCode(),
    });
  });
