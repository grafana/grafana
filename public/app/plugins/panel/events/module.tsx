import {
    PanelPlugin,
} from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { PaginationEditor } from '../table/PaginationEditor';
import { tableMigrationHandler, tablePanelChangedHandler } from '../table/migrations';

import { EventsPanel } from './EventsPanel';
import { Options, defaultOptions, FieldConfig } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(EventsPanel)
    .setPanelChangeHandler(tablePanelChangedHandler)
    .setMigrationHandler(tableMigrationHandler)
    .setPanelOptions((builder) => {
        builder
            .addBooleanSwitch({
                path: 'showHeader',
                name: 'Show table header',
                defaultValue: defaultOptions.showHeader,
            })
            .addRadio({
                path: 'cellHeight',
                name: 'Cell height',
                defaultValue: defaultOptions.cellHeight,
                settings: {
                    options: [
                        { value: TableCellHeight.Sm, label: 'Small' },
                        { value: TableCellHeight.Md, label: 'Medium' },
                        { value: TableCellHeight.Lg, label: 'Large' },
                    ],
                },
            })
            .addCustomEditor({
                id: 'footer.enablePagination',
                path: 'footer.enablePagination',
                name: 'Enable pagination',
                editor: PaginationEditor,
            });
    });
