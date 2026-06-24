import { Trans, t } from '@grafana/i18n';
import { Button, Stack, Text, Tooltip } from '@grafana/ui';

interface GenerateSummaryButtonProps {
  onClick: () => void;
  disabled: boolean;
}

/**
 * Fills the summary annotation from a plain-English reading of the alert's query.
 * Deterministic and offline — no LLM involved — so it always produces something.
 */
export function GenerateSummaryButton({ onClick, disabled }: GenerateSummaryButtonProps) {
  const button = (
    <Button type="button" variant="secondary" icon="comment-alt" disabled={disabled} onClick={onClick}>
      <Trans i18nKey="alerting.annotations-step.generate-summary">Generate summary from query</Trans>
    </Button>
  );

  return (
    <Stack direction="row" gap={1} alignItems="center">
      {disabled ? (
        <Tooltip
          content={t(
            'alerting.annotations-step.generate-summary-disabled',
            'Define a query first to generate a summary'
          )}
        >
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.annotations-step.generate-summary-hint">Reads your query — no AI required</Trans>
      </Text>
    </Stack>
  );
}
