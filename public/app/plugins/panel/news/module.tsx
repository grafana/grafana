import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { NewsPanel } from './NewsPanel';
import { DEFAULT_FEED_URL } from './constants';
import { Options, defaultOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(NewsPanel).setPanelOptions((builder) => {
  const category = [t('news.category-news', 'News')];
  builder
    .addTextInput({
      path: 'feedUrl',
      name: t('news.name-url', 'URL'),
      category,
      description: t('news.description-url', 'Supports RSS and Atom feeds'),
      settings: {
        placeholder: DEFAULT_FEED_URL,
      },
      defaultValue: defaultOptions.feedUrl,
    })
    .addBooleanSwitch({
      path: 'showImage',
      name: t('news.name-show-image', 'Show image'),
      category,
      description: t(
        'news.description-show-image',
        'Controls if the news item social (og:image) image is shown above text content'
      ),
      defaultValue: defaultOptions.showImage,
    });
});
