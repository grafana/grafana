import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FieldNamePicker } from '@grafana/ui/internal';

import { ModelType } from './regression';

export const getModelTypeOptions = () =>
  [
    {
      label: t('transformers.regression-transformer-editor.model-type-options.label.linear', 'Linear'),
      value: ModelType.linear,
    },
    {
      label: t('transformers.regression-transformer-editor.model-type-options.label.polynomial', 'Polynomial'),
      value: ModelType.polynomial,
    },
  ] as const satisfies Array<{ label: string; value: ModelType }>;

export const fieldNamePickerSettings = {
  editor: FieldNamePicker,
  id: '',
  name: '',
  settings: { width: 24, isClearable: false },
} as const;

export const LABEL_WIDTH = 20;

export const FIELD_MATCHERS = {
  timeMatcher: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
  numericMatcher: fieldMatchers.get(FieldMatcherID.numeric).get({}),
};
