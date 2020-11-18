import React, { FC, useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { VariableQueryProps } from 'app/types/plugins';
import { InlineField, TextArea, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const LEGACY_VARIABLE_QUERY_EDITOR_NAME = 'Grafana-LegacyVariableQueryEditor';

export const LegacyVariableQueryEditor: FC<VariableQueryProps> = ({ onChange, query }) => {
  const styles = useStyles(getStyles);
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
    <div className="gf-form">
      <InlineField label="Query" labelWidth={20} grow={false} className={styles.inlineFieldOverride}>
        <span hidden />
      </InlineField>
      <TextArea
        rows={getLineCount(value)}
        className="gf-form-input"
        value={value}
        onChange={onValueChange}
        onBlur={onBlur}
        placeholder="metric name or tags query"
        required
        aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput}
      />
    </div>
  );
};

function getStyles(theme: GrafanaTheme) {
  return {
    inlineFieldOverride: css`
      margin: 0;
    `,
  };
}

LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;

const getLineCount = (value: any) => {
  if (value && typeof value === 'string') {
    return value.split('\n').length;
  }

  return 1;
};
