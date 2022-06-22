/* istanbul ignore file */

import { PanelPlugin } from '@grafana/data';
import { VideoOptions } from './types';
import { YoutubePanel } from './YoutubePanel';

export const plugin = new PanelPlugin<VideoOptions>(YoutubePanel).setPanelOptions(builder => {
  return builder
    .addTextInput({
      path: 'videoId',
      name: 'Video ID',
      description: 'The value after watch?v= in the URL.',
      defaultValue: 'vYZzMk0NkgM',
      settings: {
        placeholder: 'vYZzMk0NkgM',
      },
    })
    .addBooleanSwitch({
      path: 'autoPlay',
      name: 'Autoplay',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'loop',
      name: 'Loop',
      defaultValue: true,
    });
});
