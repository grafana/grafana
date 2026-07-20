import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Text, TextLink } from '@grafana/ui';

interface ListHeaderProps {
  error: Error | undefined;
  onCreateFromScratch: () => void;
}

export const ListHeader = ({ error, onCreateFromScratch }: ListHeaderProps) => (
  <>
    {error && (
      <Alert title={t('dashboard-library.suggested-error-title', 'Error loading suggested dashboard')} severity="error">
        <Trans i18nKey="dashboard-library.suggested-error-description">Failed to load suggested dashboard.</Trans>
      </Alert>
    )}

    <Box
      display="flex"
      direction={{ xs: 'column', lg: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', lg: 'center' }}
    >
      <Text element="p">
        <Trans i18nKey="dashboard-library.merged-description">
          Browse and select from data-source provided or community dashboards
        </Trans>
      </Text>
      <TextLink href="/dashboard/new" onClick={onCreateFromScratch} inline={false} icon="arrow-right">
        {t('dashboard-library.create-from-scratch', 'Create a dashboard from scratch instead')}
      </TextLink>
    </Box>
  </>
);
