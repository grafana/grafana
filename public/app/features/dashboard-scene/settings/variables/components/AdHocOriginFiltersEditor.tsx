import { ReactElement } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { AdHocFiltersComboboxRenderer, AdHocFiltersController } from '@grafana/scenes';
import { Field, Stack } from '@grafana/ui';

export interface AdHocOriginFiltersEditorProps {
  controller: AdHocFiltersController;
}

export function AdHocOriginFiltersEditor({ controller }: AdHocOriginFiltersEditorProps): ReactElement {
  return (
    <Stack
      direction="column"
      gap={1}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.originFiltersSection}
    >
      <Field
        label={t('dashboard-scene.adhoc-origin-filters-editor.label', 'Default filters')}
        description={t(
          'dashboard-scene.adhoc-origin-filters-editor.description',
          'Filters that are pre-selected by default.'
        )}
        noMargin
      >
        <AdHocFiltersComboboxRenderer controller={controller} />
      </Field>
    </Stack>
  );
}
