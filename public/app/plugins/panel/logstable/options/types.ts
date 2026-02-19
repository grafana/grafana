import type { Options as TableOptions } from '@grafana/schema/dist/esm/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';

import type { Options as LogsTableOptions } from '../panelcfg.gen';

export type Options = LogsTableOptions & TableOptions;
