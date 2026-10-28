import { type ReactElement, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { AdHocFiltersComboboxRenderer, type AdHocFiltersController } from '@grafana/scenes';
import { Field, Stack } from '@grafana/ui';
import { useOptionsPaneReadOnly } from 'app/features/dashboard/components/PanelEditor/OptionsPaneReadOnlyContext';

export interface AdHocOriginFiltersEditorProps {
  controller: AdHocFiltersController;
}

export function AdHocOriginFiltersEditor({ controller }: AdHocOriginFiltersEditorProps): ReactElement {
  const readOnly = useOptionsPaneReadOnly();
  const renderedController = useMemo(() => (readOnly ? withReadOnly(controller) : controller), [controller, readOnly]);

  return (
    <Stack direction="column" gap={1}>
      <Field
        label={t('dashboard-scene.adhoc-origin-filters-editor.label', 'Default filters')}
        description={t(
          'dashboard-scene.adhoc-origin-filters-editor.description',
          'Filters that are pre-selected by default.'
        )}
        noMargin
        disabled={readOnly ? true : undefined}
      >
        <div inert={readOnly ? true : undefined}>
          <AdHocFiltersComboboxRenderer controller={renderedController} />
        </div>
      </Field>
    </Stack>
  );
}

/** The combobox reads `readOnly` from controller state and hides its inputs when that flag is set. */
function withReadOnly(controller: AdHocFiltersController): AdHocFiltersController {
  return new Proxy(controller, {
    get(target, prop) {
      if (prop === 'useState') {
        return () => ({ ...target.useState(), readOnly: true });
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
