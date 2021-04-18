import { isString } from 'lodash';
import { PanelPlugin } from '@grafana/data';
import { NewsPanel } from './NewsPanel';
import { PanelOptions, defaultPanelOptions } from './models.gen';
import { DEFAULT_FEED_URL, PROXY_PREFIX } from './constants';

export const plugin = new PanelPlugin<PanelOptions>(NewsPanel).setPanelOptions((builder) => {
  builder
    .addTextInput({
      path: 'feedUrl',
      name: 'URL',
      description: 'Only RSS feed formats are supported (not Atom).',
      settings: {
        placeholder: DEFAULT_FEED_URL,
      },
      defaultValue: defaultPanelOptions.feedUrl,
    })
    .addBooleanSwitch({
      path: 'useProxy',
      name: 'Use Proxy',
      description: 'If the feed is unable to connect, consider a CORS proxy',
      showIf: (currentConfig: PanelOptions) => {
        return isString(currentConfig.feedUrl) && !currentConfig.feedUrl.startsWith(PROXY_PREFIX);
      },
      defaultValue: defaultPanelOptions.useProxy,
    });
});
