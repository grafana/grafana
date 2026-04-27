import { memo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers, type ByNamesMatcherOptions } from '@grafana/data/transformations';
import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';

import { Input } from '../Input/Input';
import { MultiSelect } from '../Select/Select';

import { type MatcherUIProps, type FieldMatcherUIRegistryItem } from './types';
import { useFieldDisplayNames, useMatcherSelectOptions, frameHasName } from './utils';

export const FieldNamesMatcherEditor = memo<MatcherUIProps<ByNamesMatcherOptions>>((props) => {
  const { id, data, options, onChange: onChangeFromProps, scope } = props;
  const { readOnly, prefix } = options;
  const names = useFieldDisplayNames(data, undefined, scope);
  const selectOptions = useMatcherSelectOptions(names, undefined, { scope });

  const onChange = useCallback(
    (selections: Array<SelectableValue<string>>) => {
      if (!Array.isArray(selections)) {
        return;
      }

      return onChangeFromProps({
        ...options,
        names: selections.reduce((all: string[], current) => {
          if (!frameHasName(current.value, names)) {
            return all;
          }
          all.push(current.value!);
          return all;
        }, []),
      });
    },
    [names, onChangeFromProps, options]
  );

  if (readOnly) {
    const displayNames = (options.names ?? []).join(', ');
    return <Input id={id} value={displayNames} readOnly={true} disabled={true} prefix={prefix} />;
  }

  return <MultiSelect inputId={id} value={options.names} options={selectOptions} onChange={onChange} />;
});
FieldNamesMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const getFieldNamesMatcherItem: () => FieldMatcherUIRegistryItem<ByNamesMatcherOptions> = () => ({
  id: FieldMatcherID.byNames,
  component: FieldNamesMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byNames),
  name: t('grafana-ui.matchers-ui.name-fields-with-name', 'Fields with name'),
  description: t('grafana-ui.matchers-ui.description-fields-with-name', 'Set properties for a specific field'),
  optionsToLabel: (options) => (options.names ?? []).join(', '),
  excludeFromPicker: true,
});
