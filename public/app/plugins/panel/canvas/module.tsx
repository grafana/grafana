import { PanelPlugin } from '@grafana/data';

import { CanvasPanel } from './CanvasPanel';
import { defaultPanelOptions, PanelOptions } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions>(CanvasPanel).setPanelOptions((builder) => {
  builder.addRadio({
    path: 'mode',
    name: 'Mode',
    description: 'text mode of the panel',
    settings: {
      options: [
        { value: TextMode.Markdown, label: 'Markdown' },
        { value: TextMode.HTML, label: 'HTML' },
      ],
    },
    defaultValue: defaultPanelOptions.mode,
  });
});
