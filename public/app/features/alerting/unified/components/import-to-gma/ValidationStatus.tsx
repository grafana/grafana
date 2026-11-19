import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack, Text } from '@grafana/ui';

import { RenamedResourcesList } from './CollapsibleRenameList';
import { type DryRunValidationResult } from './types';

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
        <ErrorDetails error={result.error} />
      </Alert>
    );
  }

  return null;
}

/**
 * The backend can report several strict-decoding errors in one newline-separated message:
 * the first line is the summary and each following line is one error.
 */
function ErrorDetails({ error }: { error?: string }) {
  const [summary, ...details] = (error ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!summary) {
    return (
      <Text>{t('alerting.import-to-gma.step1.validation-error-desc', 'Failed to validate the configuration.')}</Text>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <Text>{summary}</Text>
      {details.length > 0 && (
        <Box element="ul" margin={0} paddingLeft={3}>
          {details.map((detail, index) => (
            <Text key={index} element="li">
              {detail}
            </Text>
          ))}
        </Box>
      )}
    </Stack>
  );
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
