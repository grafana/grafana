import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { plugin as pluginV1 } from './v1/module';
import { plugin as pluginV2 } from './v2/module';

// Both versions register under the same plugin id, so dashboards always persist type "text"
// and no migration is needed when v2 becomes the default.
export const plugin = getFeatureFlagClient().getBooleanValue('grafana.newTextPanel', false) ? pluginV2 : pluginV1;
