import { PanelPlugin } from '@grafana/data';
import { Options, defaultOptions } from '@grafana/schema/src/raw/composable/news/panelcfg/x/NewsPanelCfg_types.gen';

import { NewsPanel } from './NewsPanel';
import { DEFAULT_FEED_URL } from './constants';

export const plugin = new PanelPlugin<Options>(NewsPanel).setPanelOptions((builder) => {
  builder
    .addTextInput({
      path: 'feedUrl',
      name: 'URL',
      description: 'Supports RSS and Atom feeds',
      settings: {
        placeholder: DEFAULT_FEED_URL,
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
