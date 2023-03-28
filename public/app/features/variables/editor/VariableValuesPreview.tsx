import { css } from '@emotion/css';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, InlineFieldRow, InlineLabel, useStyles2 } from '@grafana/ui';

import { VariableOption, VariableWithOptions } from '../types';

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
  const styles = useStyles2(getStyles);
  useEffect(() => setPreviewOptions(options.slice(0, previewLimit)), [previewLimit, options]);

  if (!previewOptions.length) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
      <h5>Preview of values</h5>
      <InlineFieldRow>
        {previewOptions.map((o, index) => (
          <InlineFieldRow key={`${o.value}-${index}`} className={styles.optionContainer}>
            <InlineLabel aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption}>
              <div className={styles.label}>{o.text}</div>
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
    </div>
  );
};
VariableValuesPreview.displayName = 'VariableValuesPreview';

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      marginTop: theme.spacing(2),
    }),
    optionContainer: css({
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
    }),
    label: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '50vw',
    }),
  };
}
