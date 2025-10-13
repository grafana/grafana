import { PanelPlugin } from '@grafana/data';

import { CheckPanel } from './CheckPanel';

export const plugin = new PanelPlugin(CheckPanel);
