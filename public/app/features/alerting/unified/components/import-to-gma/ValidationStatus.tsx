import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack, Text } from '@grafana/ui';

import { RenamedResourcesList } from './CollapsibleRenameList';
import { DryRunValidationResult } from './types';

interface ValidationStatusProps {
  state: 'loading' | 'success' | 'warning' | 'error';
  result?: DryRunValidationResult;
}

/**
 * Displays the current state of a dry-run validation:
 * loading spinner, success alert, rename warnings, or error details.
 */
export function ValidationStatus({ state, result }: ValidationStatusProps) {
  if (state === 'loading') {
    return (
      <Box padding={2} backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" />
          <Text color="secondary">{t('alerting.import-to-gma.step1.validating', 'Validating configuration...')}</Text>
        </Stack>
      </Box>
    );
  }

  if (state === 'success') {
    return (
      <Alert severity="success" title={t('alerting.import-to-gma.step1.validation-success', 'Validation successful')}>
        <Trans i18nKey="alerting.import-to-gma.step1.validation-success-desc">
          No conflicts found. The configuration is ready to import.
        </Trans>
      </Alert>
    );
  }

  if (state === 'warning' && result) {
    return <RenameWarning result={result} />;
  }

  if (state === 'error' && result) {
    return (
      <Alert severity="error" title={t('alerting.import-to-gma.step1.validation-error', 'Validation failed')}>
        <Text>
          {result.error ||
            t('alerting.import-to-gma.step1.validation-error-desc', 'Failed to validate the configuration.')}
        </Text>
      </Alert>
    );
  }

  return null;
}

/**
 * Shows a collapsible list of resources that will be renamed during import.
 */
function RenameWarning({ result }: { result: DryRunValidationResult }) {
  return (
    <Alert
      severity="warning"
      title={t(
        'alerting.import-to-gma.step1.validation-warning',
        'Some resources will be renamed to avoid conflicts with existing ones'
      )}
    >
      <RenamedResourcesList
        renamedReceivers={result.renamedReceivers}
        renamedTimeIntervals={result.renamedTimeIntervals}
      />
    </Alert>
  );
}
