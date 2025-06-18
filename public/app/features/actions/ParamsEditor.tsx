import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { contentTypeOptions, GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Input, Stack, Select, useStyles2 } from '@grafana/ui';

import { SuggestionsInput } from '../transformers/suggestionsInput/SuggestionsInput';

interface Props {
  onChange: (v: Array<[string, string]>) => void;
  value: Array<[string, string]>;
  suggestions: VariableSuggestion[];
  contentTypeHeader?: boolean;
}

export const ParamsEditor = ({ value, onChange, suggestions, contentTypeHeader = false }: Props) => {
  const styles = useStyles2(getStyles);

  const headersContentType = value.find(([key, value]) => key === 'Content-Type');

  const [paramName, setParamName] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [contentTypeParamValue, setContentTypeParamValue] = useState('');

  useEffect(() => {
    if (contentTypeParamValue !== '') {
      setContentTypeParamValue(contentTypeParamValue);
    } else if (headersContentType) {
      setContentTypeParamValue(headersContentType[1]);
    }
  }, [contentTypeParamValue, headersContentType]);

  // forces re-init of first SuggestionsInput(s), since they are stateful and don't respond to 'value' prop changes to be able to clear them :(
  const [entryKey, setEntryKey] = useState(Math.random().toString());

  const changeParamValue = (paramValue: string) => {
    setParamValue(paramValue);
  };

  const changeParamName = (paramName: string) => {
    setParamName(paramName);
  };

  const removeParam = (key: string) => () => {
    const updatedParams = value.filter((param) => param[0] !== key);
    onChange(updatedParams);
  };

  const addParam = (contentType?: [string, string]) => {
    let newParams: Array<[string, string]>;

    if (value) {
      newParams = value.filter((e) => e[0] !== (contentType ? contentType[0] : paramName));
    } else {
      newParams = [];
    }

    newParams.push(contentType ?? [paramName, paramValue]);
    newParams.sort((a, b) => a[0].localeCompare(b[0]));
    onChange(newParams);

    setParamName('');
    setParamValue('');
    setEntryKey(Math.random().toString());
  };

  const changeContentTypeParamValue = (value: string) => {
    setContentTypeParamValue(value);
    addParam(['Content-Type', value]);
  };

  const isAddParamsDisabled = paramName === '' || paramValue === '';

  return (
    <div>
      <Stack direction="row" key={entryKey}>
        <SuggestionsInput
          value={paramName}
          onChange={changeParamName}
          suggestions={suggestions}
          placeholder={t('actions.params-editor.placeholder-key', 'Key')}
          style={{ width: 332 }}
        />
        <SuggestionsInput
          value={paramValue}
          onChange={changeParamValue}
          suggestions={suggestions}
          placeholder={t('actions.params-editor.placeholder-value', 'Value')}
          style={{ width: 332 }}
        />
        <IconButton
          aria-label={t('actions.params-editor.aria-label-add', 'Add')}
          name="plus-circle"
          onClick={() => addParam()}
          disabled={isAddParamsDisabled}
        />
      </Stack>

      <Stack direction="column">
        {Array.from(value.filter((param) => param[0] !== 'Content-Type') || []).map((entry) => (
          <Stack key={entry[0]} direction="row">
            <Input disabled value={entry[0]} />
            <Input disabled value={entry[1]} />
            <IconButton
              aria-label={t('actions.params-editor.aria-label-delete', 'Delete')}
              onClick={removeParam(entry[0])}
              name="trash-alt"
            />
          </Stack>
        ))}
      </Stack>

      {contentTypeHeader && (
        <div className={styles.extraHeader}>
          <Stack direction="row">
            <Input value={'Content-Type'} disabled />
            <Select
              onChange={(select) => changeContentTypeParamValue(select.value as string)}
              options={contentTypeOptions}
              value={contentTypeParamValue}
            />
          </Stack>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  extraHeader: css({
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    maxWidth: 673,
  }),
});
