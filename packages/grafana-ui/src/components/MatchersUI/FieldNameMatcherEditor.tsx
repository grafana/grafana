import { memo, useCallback } from 'react';

import { DataTopic, FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';

import { FieldMatcherUIRegistryItem, MatcherUIProps } from './types';
import { frameHasName, useFieldDisplayNames, useSelectOptions } from './utils';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { series, annotations = [], options, onChange: onChangeFromProps, id, allowedScopes } = props;
  const areNestedFieldsAllowed = allowedScopes?.includes('nested');
  const areAnnotationFieldsAllowed = allowedScopes?.includes('annotation');

  const seriesNames = useFieldDisplayNames(
    [...series, ...annotations],
    (field) => areNestedFieldsAllowed || field.type !== FieldType.nestedFrames,
    (frame) => areAnnotationFieldsAllowed || frame.meta?.dataTopic !== DataTopic.Annotations
  );

  const selectOptions = useSelectOptions(seriesNames, options);

  const onChange = useCallback(
    (selection: ComboboxOption) => {
      if (!frameHasName(selection.value, seriesNames)) {
        return;
      }

      const scope = seriesNames.scopes.get(selection.value);
      return onChangeFromProps(selection.value, scope);
    },
    [seriesNames, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return (
    <Combobox
      value={selectedOption}
      options={selectOptions}
      onChange={onChange}
      placeholder={t('grafana-ui.select.placeholder', 'Choose')}
      id={id}
    />
  );
});
FieldNameMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const getFieldNameMatcherItem: () => FieldMatcherUIRegistryItem<string> = () => ({
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: t('grafana-ui.matchers-ui.name-fields-with-name', 'Fields with name'),
  description: t('grafana-ui.matchers-ui.description-fields-with-name', 'Set properties for a specific field'),
  optionsToLabel: (options) => options,
});
