import { useId } from '@react-aria/utils';
import React, { useCallback, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { TextArea, useStyles2 } from '@grafana/ui';

import { VariableQueryEditorProps } from '../types';

import { getStyles } from './VariableTextAreaField';

export const LEGACY_VARIABLE_QUERY_EDITOR_NAME = 'Grafana-LegacyVariableQueryEditor';

export const LegacyVariableQueryEditor = ({ onChange, query }: VariableQueryEditorProps) => {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState(query);
  const onValueChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    setValue(event.currentTarget.value);
  };

  const onBlur = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      onChange(event.currentTarget.value, event.currentTarget.value);
    },
    [onChange]
  );

  const id = useId();

  return (
    <TextArea
      id={id}
      rows={2}
      value={value}
      onChange={onValueChange}
      onBlur={onBlur}
      placeholder="Metric name or tags query"
      required
      aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput}
      cols={52}
      className={styles.textarea}
    />
  );
};

LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;
