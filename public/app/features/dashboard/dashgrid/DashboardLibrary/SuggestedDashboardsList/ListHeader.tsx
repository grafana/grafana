import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Text, TextLink } from '@grafana/ui';

interface ListHeaderProps {
  error: Error | undefined;
  onCreateFromScratch: () => void;
}

export const ListHeader = ({ error, onCreateFromScratch }: ListHeaderProps) => (
  <>
    {error && (
      <div>
        <Alert
          title={t('dashboard-library.community-error-title', 'Error loading community dashboard')}
          severity="error"
        >
          <Trans i18nKey="dashboard-library.community-error-description">Failed to load community dashboard.</Trans>
        </Alert>
      </div>
    )}

    <Box display="flex" justifyContent="space-between" alignItems="center">
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
