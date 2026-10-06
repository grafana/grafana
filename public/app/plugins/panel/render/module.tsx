import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { RenderCodeEditor } from './RenderCodeEditor';
import { RenderPanel } from './RenderPanel';
import { renderPanelChangeHandler } from './migrations';
import { getDefaultRenderCode } from './templates';
import { type Options } from './types';

export const plugin = new PanelPlugin<Options>(RenderPanel)
  .setNoPadding()
  .setFitContentSupport()
  .setPanelChangeHandler(renderPanelChangeHandler)
  .setPanelOptions((builder) => {
    builder.addCustomEditor({
      id: 'code',
      path: 'code',
      name: t('render-panel.options.code', 'Drawing code'),
      description: t(
        'render-panel.options.code-description',
        'JavaScript that draws the panel data. It is stored in the dashboard and runs in a sandbox.'
      ),
      editor: RenderCodeEditor,
      defaultValue: getDefaultRenderCode(),
    });
  });
