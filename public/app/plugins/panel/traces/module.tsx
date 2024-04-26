import { PanelPlugin } from '@grafana/data';

import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel).setSuggestionsSupplier(new TracesSuggestionsSupplier());
