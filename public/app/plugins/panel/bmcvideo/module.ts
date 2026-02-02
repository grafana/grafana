import { PanelPlugin, PanelModel } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { BMCVideoPanel } from './BMCVideoPanel';
import { VideoOptions } from './types';

export const plugin = new PanelPlugin<VideoOptions>(BMCVideoPanel)
  .setPanelOptions((builder) => {
    builder.addTextInput({
      path: 'url',
      name: t('bmc.panel.bmc-video.url', 'Video URL'),
      settings: {
        placeholder: t('bmc.panel.bmc-video.enter-video', 'Enter embeded video'),
      },
    });
  })
  .setPanelChangeHandler((panel: PanelModel<VideoOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'text') {
      return prevOptions as VideoOptions;
    }
    return panel.options;
  });
