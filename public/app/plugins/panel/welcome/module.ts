import { PanelPlugin } from '@grafana/data/panel';

import { WelcomeBanner } from './Welcome';

export const plugin = new PanelPlugin(WelcomeBanner).setNoPadding();
