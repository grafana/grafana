import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SuggestionsInput } from 'app/features/transformers/suggestionsInput/SuggestionsInput';
import { getVariableName } from 'app/features/variables/inspect/utils';

interface Settings {}

export const VariableNameEditor = ({ value, onChange, context }: StandardEditorProps<string, Settings>) => {
  const suggestions = context.getSuggestions?.() ?? [];

  const handleChange = (newValue: string) => {
    const cleanValue = getVariableName(newValue) ?? newValue;
    onChange(cleanValue);
  };

  return (
    <SuggestionsInput
      value={value}
      onChange={handleChange}
      suggestions={suggestions}
      placeholder={t('geomap.variable-name-editor.placeholder', 'Select variable')}
    />
  );
};
