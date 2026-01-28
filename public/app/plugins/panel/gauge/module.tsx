import { config } from '@grafana/runtime';

import { plugin as pluginV1 } from './v1/module';
import { plugin as pluginV2 } from './v2/module';

export const plugin = config.featureToggles.newGauge ? pluginV2 : pluginV1;
