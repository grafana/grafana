import { PanelPlugin } from '@grafana/data';

import { FlameGraphPanel } from './FlameGraphPanel';
import { FlameGraphSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(FlameGraphPanel).setSuggestionsSupplier(new FlameGraphSuggestionsSupplier());
