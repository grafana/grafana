import { plugin as pluginV1 } from './v1/module';
import { plugin as pluginV2 } from './v2/module';
import { isNewTextPanelEnabled } from './v2/utils';

// Both versions register under the same plugin id, so dashboards always persist type "text"
// and no migration is needed when v2 becomes the default.
export const plugin = (isNewTextPanelEnabled() ? pluginV2 : pluginV1).setFitContentSupport();
