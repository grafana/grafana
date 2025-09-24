import { memo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;
  const names = useFieldDisplayNames(data);
  const selectOptions = useSelectOptions(names, options);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!frameHasName(selection.value, names)) {
        return;
      }
      return onChangeFromProps(selection.value!);
    },
    [names, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select value={selectedOption} options={selectOptions} onChange={onChange} inputId={id} />;
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
