import React, { MouseEvent, useCallback, useEffect, useState } from 'react';
import { VariableOption, VariableWithOptions } from '../types';
import { selectors } from '@grafana/e2e-selectors';
import { Button, InlineFieldRow, InlineLabel, useStyles, VerticalGroup } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export interface VariableValuesPreviewProps {
  variable: VariableWithOptions;
}

export const VariableValuesPreview: React.FunctionComponent<VariableValuesPreviewProps> = ({
  variable: { options },
}) => {
  const [previewLimit, setPreviewLimit] = useState(20);
  const [previewOptions, setPreviewOptions] = useState<VariableOption[]>([]);
  const showMoreOptions = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setPreviewLimit(previewLimit + 20);
    },
    [previewLimit, setPreviewLimit]
  );
  const styles = useStyles(getStyles);
  useEffect(() => setPreviewOptions(options.slice(0, previewLimit)), [previewLimit, options]);

  if (!previewOptions.length) {
    return null;
  }

  return (
    <VerticalGroup spacing="none">
      <h5>Preview of values</h5>
      <InlineFieldRow>
        {previewOptions.map((o, index) => (
          <InlineFieldRow key={`${o.value}-${index}`} className={styles.optionContainer}>
            <InlineLabel aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption}>
              {o.text}
            </InlineLabel>
          </InlineFieldRow>
        ))}
      </InlineFieldRow>
      {options.length > previewLimit && (
        <InlineFieldRow className={styles.optionContainer}>
          <Button
            onClick={showMoreOptions}
            variant="secondary"
            size="sm"
            aria-label="Variable editor Preview of Values Show More link"
          >
            Show more
          </Button>
        </InlineFieldRow>
      )}
    </VerticalGroup>
  );
};
VariableValuesPreview.displayName = 'VariableValuesPreview';

function getStyles(theme: GrafanaTheme) {
  return {
    optionContainer: css`
      margin-left: ${theme.spacing.xs};
      margin-bottom: ${theme.spacing.xs};
    `,
  };
}
