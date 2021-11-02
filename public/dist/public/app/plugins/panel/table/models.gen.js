//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import { TableCellDisplayMode } from '@grafana/ui';
// Only the latest schema version is translated to TypeScript, on the premise
// that either the dashboard loading process, or (eventually) CUE-defined
// migrations ensure that bulk of the frontend application only ever
// need directly consider the most recent version of the schema.
export var modelVersion = Object.freeze([1, 0]);
export var defaultPanelOptions = {
    frameIndex: 0,
    showHeader: true,
    showTypeIcons: false,
    footer: {
        show: false,
        reducer: [],
    },
};
export var defaultPanelFieldConfig = {
    displayMode: TableCellDisplayMode.Auto,
    align: 'auto',
};
//# sourceMappingURL=models.gen.js.map