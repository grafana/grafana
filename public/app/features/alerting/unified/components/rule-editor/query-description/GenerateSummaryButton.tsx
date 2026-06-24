import { t } from '@grafana/i18n';
import { Button, Stack, Text, Tooltip } from '@grafana/ui';

interface GenerateSummaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function GenerateSummaryButton({ onClick, disabled }: GenerateSummaryButtonProps) {
  const button = (
    <Button type="button" icon="document-info" variant="secondary" onClick={onClick} disabled={disabled} size="sm">
      {t('alerting.query-description.generate-summary', 'Generate summary from query')}
    </Button>
  );

  return (
    <Stack direction="column" gap={0.5} alignItems="flex-start">
      {disabled ? (
        <Tooltip
          content={t(
            'alerting.query-description.disabled-tooltip',
            'Add a data source query to generate a summary'
          )}
        >
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      <Text variant="bodySmall" color="secondary">
        {t('alerting.query-description.hint', 'Reads your query — no AI required')}
      </Text>
    </Stack>
  );
}
