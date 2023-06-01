import { PanelPlugin } from '@grafana/data';
import config from 'app/core/config';

import { NewsPanel } from './NewsPanel';
import { Options, defaultOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(NewsPanel).setPanelOptions((builder) => {
  builder
    .addTextInput({
      path: 'feedUrl',
      name: 'URL',
      description: 'Supports RSS and Atom feeds',
      settings: {
        placeholder: config.newsFeedUrl,
      },
      defaultValue: defaultOptions.feedUrl,
    })
    .addBooleanSwitch({
      path: 'showImage',
      name: 'Show image',
      description: 'Controls if the news item social (og:image) image is shown above text content',
      defaultValue: defaultOptions.showImage,
    });
});
