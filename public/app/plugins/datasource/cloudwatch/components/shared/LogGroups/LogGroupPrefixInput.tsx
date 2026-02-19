import { useMemo } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { LOG_GROUP_PREFIX_MAX, LOG_GROUP_PREFIX_MIN_LENGTH } from '../../../utils/logGroupsConstants';

export interface LogGroupPrefixInputProps {
  prefixes: string[];
  onChange: (prefixes: string[]) => void;
  variables?: string[];
  disabled?: boolean;
}

export const LogGroupPrefixInput = ({ prefixes, onChange, variables = [], disabled }: LogGroupPrefixInputProps) => {
  const variableOptions = useMemo(() => variables.filter((v) => v.startsWith('$')).map(toOption), [variables]);

  const options: Array<SelectableValue<string>> = useMemo(() => {
    const existingOptions = prefixes.map(toOption);
    return [...existingOptions, ...variableOptions];
  }, [prefixes, variableOptions]);

  const handleChange = (selected: Array<SelectableValue<string>>) => {
    const newPrefixes = selected.filter(({ value }) => value).map(({ value }) => value!);
    onChange(newPrefixes);
  };

  const isAtMaxPrefixes = prefixes.length >= LOG_GROUP_PREFIX_MAX;

  const isValidNewOption = (inputValue: string) => {
    if (isAtMaxPrefixes) {
      return false;
    }
    if (inputValue.startsWith('$')) {
      return true;
    }
    return inputValue.length >= LOG_GROUP_PREFIX_MIN_LENGTH && !inputValue.includes('*');
  };

  return (
    <EditorField
      label="Prefixes"
      tooltip={`Enter log group name prefixes (max ${LOG_GROUP_PREFIX_MAX}, min ${LOG_GROUP_PREFIX_MIN_LENGTH} characters each, must not contain "*"). Template variables are supported.`}
    >
      <MultiSelect
        inputId="log-group-prefixes"
        aria-label="Log group prefixes"
        allowCustomValue
        isValidNewOption={isValidNewOption}
        options={options}
        value={prefixes}
        onChange={handleChange}
        closeMenuOnSelect={false}
        isClearable
        isOptionDisabled={() => isAtMaxPrefixes}
        placeholder={
          isAtMaxPrefixes
            ? `Maximum ${LOG_GROUP_PREFIX_MAX} prefixes reached`
            : `Add up to ${LOG_GROUP_PREFIX_MAX} prefixes`
        }
        noOptionsMessage={
          isAtMaxPrefixes
            ? `Maximum ${LOG_GROUP_PREFIX_MAX} prefixes reached`
            : `Type to add a prefix (min ${LOG_GROUP_PREFIX_MIN_LENGTH} characters, must not contain "*")`
        }
        disabled={disabled}
        width={50}
      />
    </EditorField>
  );
};
