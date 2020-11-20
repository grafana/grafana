import React, { FC, useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { VariableQueryProps } from 'app/types/plugins';
import { VariableTextAreaField } from './VariableTextAreaField';

export const LEGACY_VARIABLE_QUERY_EDITOR_NAME = 'Grafana-LegacyVariableQueryEditor';

export const LegacyVariableQueryEditor: FC<VariableQueryProps> = ({ onChange, query }) => {
  const [value, setValue] = useState(query);
  const onValueChange = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      setValue(event.currentTarget.value);
    },
    [onChange]
  );

  const onBlur = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      onChange(event.currentTarget.value, event.currentTarget.value);
    },
    [onChange]
  );

  return (
    <VariableTextAreaField
      name="Query"
      value={value}
      placeholder="metric name or tags query"
      width={100}
      onChange={onValueChange}
      onBlur={onBlur}
      required
      labelWidth={20}
      aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput}
    />
  );
};

LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;
