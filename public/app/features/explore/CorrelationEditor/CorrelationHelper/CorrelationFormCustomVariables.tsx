import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, DeleteButton, IconButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { CorrelationFormCustomVariablesProps } from '../types';

import { FormSection } from './FormSection';

export const CorrelationFormCustomVariables = ({
  correlations,
  transformations,
  handlers,
}: CorrelationFormCustomVariablesProps) => {
  const styles = useStyles2(getStyles);

  const transformationMap = useMemo(
    () => new Map(transformations.map((t, idx) => [t.mapValue, idx])),
    [transformations]
  );

  return (
    <FormSection title={<Trans i18nKey="explore.correlation-helper.title-variables">Variables (optional)</Trans>}>
      <Text variant="bodySmall">
        <Trans i18nKey="explore.correlation-helper.body-variables">
          Use these variables in your target query. When a correlation link is clicked, each variable is filled in with
          its value from that row.
        </Trans>
      </Text>
      <Stack direction="column" gap={1.5}>
        {Object.entries(correlations.vars).map(([name, value]) => {
          // Check if this is a custom variable (not in origVars)
          const isCustomVariable = !(name in correlations.origVars);
          const transformationIdx = transformationMap.get(name);

          return (
            <Stack key={name} direction="row" gap={1} alignItems="flex-start" justifyContent="space-between">
              <Stack direction="row" gap={1} alignItems="center" grow={1}>
                <code className={styles.variableName}>${`{${name}}`}</code>
                <Tooltip content={value} placement="auto-start">
                  <span className={styles.variableValue}>{value}</span>
                </Tooltip>
              </Stack>

              {isCustomVariable && transformationIdx !== undefined && (
                <Stack direction="row" gap={0.5}>
                  <IconButton
                    name="edit"
                    size="sm"
                    aria-label={t('explore.correlation-helper.aria-label-edit-transformation', 'Edit transformation')}
                    onClick={() => handlers.onEdit(transformationIdx)}
                  />
                  <DeleteButton
                    size="sm"
                    aria-label={t(
                      'explore.correlation-helper.aria-label-delete-transformation',
                      'Delete transformation'
                    )}
                    onConfirm={() => handlers.onDelete(transformationIdx)}
                    closeOnConfirm
                  />
                </Stack>
              )}
            </Stack>
          );
        })}
      </Stack>

      <Button variant="secondary" fill="outline" onClick={handlers.onAdd} className={styles.addButton}>
        <Trans i18nKey="explore.correlation-helper.add-custom-variable">Add custom variable</Trans>
      </Button>
    </FormSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  variableName: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),
  variableValue: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '400px',
  }),
  addButton: css({
    alignSelf: 'flex-start',
  }),
});
