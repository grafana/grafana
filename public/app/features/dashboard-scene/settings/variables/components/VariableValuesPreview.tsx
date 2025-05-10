import { css } from '@emotion/css';
import { MouseEvent, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { VariableValueOption } from '@grafana/scenes';
import { Button, InlineFieldRow, InlineLabel, useStyles2, Text } from '@grafana/ui';

export interface VariableValuesPreviewProps {
  options: VariableValueOption[];
}

export const VariableValuesPreview = ({ options }: VariableValuesPreviewProps) => {
  const [previewLimit, setPreviewLimit] = useState(20);
  const [previewOptions, setPreviewOptions] = useState<VariableValueOption[]>([]);
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
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="dashboard-scene.variable-values-preview.preview-of-values">Preview of values</Trans>
      </Text>
      <InlineFieldRow>
        {previewOptions.map((o, index) => (
          <InlineFieldRow key={`${o.value}-${index}`} className={styles.optionContainer}>
            <InlineLabel data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption}>
              <div className={styles.label}>{o.label}</div>
            </InlineLabel>
          </InlineFieldRow>
        ))}
      </InlineFieldRow>
      {options.length > previewLimit && (
        <InlineFieldRow className={styles.optionContainer}>
          <Button onClick={showMoreOptions} variant="secondary" size="sm">
            <Trans i18nKey="dashboard-scene.variable-values-preview.show-more">Show more</Trans>
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
