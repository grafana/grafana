import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { CustomPanel } from './CustomPanel';
import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { customPanelChangeHandler, customPanelMigrationHandler, needsApiVersionPin } from './migrations';
import { getDefaultDrawingCode } from './templates';
import { DEFAULT_API_VERSION, type Options } from './types';

export const plugin = new PanelPlugin<Options>(CustomPanel)
  .setNoPadding()
  .setFitContentSupport()
  .setPanelChangeHandler(customPanelChangeHandler)
  .setMigrationHandler(customPanelMigrationHandler, needsApiVersionPin)
  // The drawing code gets the display keys of field.config and the host-formatted last value, so the
  // standard options that shape them apply. Links and actions never reach the frame.
  .useFieldConfig({
    disableStandardOptions: [
      FieldConfigProperty.Links,
      FieldConfigProperty.Actions,
      FieldConfigProperty.FieldMinMax,
      FieldConfigProperty.Filterable,
    ],
  })
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: 'code',
        path: 'code',
        name: t('custom-panel.options.code', 'Drawing code'),
        description: t(
          'custom-panel.options.code-description',
          'JavaScript that draws the panel data. It is stored in the dashboard and runs in a sandbox.'
        ),
        editor: CustomPanelCodeEditor,
        defaultValue: getDefaultDrawingCode(),
      })
      // Not edited in the UI: new panels get the latest version, saved panels keep theirs.
      .addCustomEditor({
        id: 'apiVersion',
        path: 'apiVersion',
        name: t('custom-panel.options.api-version', 'Drawing API version'),
        editor: () => null,
        defaultValue: DEFAULT_API_VERSION,
        showIf: () => false,
      });
  });
