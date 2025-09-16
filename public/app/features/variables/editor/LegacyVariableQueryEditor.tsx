import { useId } from '@react-aria/utils';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TextArea, useStyles2 } from '@grafana/ui';

import { getStyles } from '../../dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableQueryEditorProps } from '../types';

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
      placeholder={t(
        'variables.legacy-variable-query-editor.placeholder-metric-name-or-tags-query',
        'Metric name or tags query'
      )}
      required
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput}
      cols={52}
      className={styles.textarea}
    />
  );
};

LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;
