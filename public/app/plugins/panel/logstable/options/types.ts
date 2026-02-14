import { TableOptions } from '@grafana/schema';

import type { Options as LogsTableOptions } from '../panelcfg.gen';

export type Options = LogsTableOptions & TableOptions;
