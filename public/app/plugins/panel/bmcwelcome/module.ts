import { PanelPlugin } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { BMCWelcomeBanner } from './BMCWelcome';
import { getdefaultDescr } from './cards';
import { Options } from './types';

export const plugin = new PanelPlugin<Options>(BMCWelcomeBanner).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      name: t('bmc.panel.bmc-welcome.documentation-description', 'Documentation description'),
      // BMC Change: Next line
      defaultValue: getdefaultDescr().doc,
      path: 'descr.doc',
    })
    .addTextInput({
      name: t('bmc.panel.bmc-welcome.video-description', 'Video description'),
      // BMC Change: Next line
      defaultValue: getdefaultDescr().video,
      path: 'descr.video',
    })
    .addTextInput({
      name: t('bmc.panel.bmc-welcome.community-description', 'Community description'),
      // BMC Change: Next line
      defaultValue: getdefaultDescr().community,
      path: 'descr.community',
    });
});
