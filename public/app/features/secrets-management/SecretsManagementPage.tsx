import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, EmptyState, FilterInput, InlineField, TextLink, useStyles2, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PageContents } from 'app/core/components/Page/PageContents';

import { useDeleteSecretMutation, useListSecretsQuery } from './api';
import { EditSecretModal } from './components/EditSecretModal';
import { SecretsList } from './components/SecretsList';
import { SecretStatusPhase } from './types';
import { getErrorMessage } from './utils';

export default function SecretsManagementPage() {
  const styles = useStyles2(getStyles);

  // Api test
  const [pollingInterval, setPollingInterval] = useState(0);
  const {
    data: secrets,
    isLoading,
    isError,
    error,
    refetch,
  } = useListSecretsQuery(undefined, {
    pollingInterval,
  });

  useEffect(() => {
    if (secrets && secrets.some((secret) => secret.status === SecretStatusPhase.Pending)) {
      setPollingInterval(500);
    } else {
      setPollingInterval(0);
    }
  }, [secrets]);

  const [deleteSecret] = useDeleteSecretMutation();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<undefined | string>();
  const [filter, setFilter] = useState('');

  const isEditModalOpen = !!editTarget || isCreateModalOpen;
  const hasSecrets = secrets && secrets.length > 0;

  const handleShowCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleDismissModal = () => {
    setIsCreateModalOpen(false);
    setEditTarget(undefined);
  };

  const handleEditSecret = useCallback((name: string) => {
    setEditTarget(name);
  }, []);

  return (
    <Page
      navId="secrets-management"
      subTitle={
        <Trans i18nKey="secrets.sub-title">
          Manage secrets for use in Grafana. Find out more in our{' '}
          <TextLink href="https://grafana.com/docs/grafana/latest/administration/" external>
            documentation
          </TextLink>
        </Trans>
      }
      actions={
        hasSecrets && (
          <Button disabled={isLoading} icon="plus" onClick={handleShowCreateModal}>
            <Trans i18nKey="secrets.actions.create-secret">Create secret</Trans>
          </Button>
        )
      }
    >
      <PageContents isLoading={isLoading}>
        <div className="page-action-bar">
          <InlineField grow disabled={!hasSecrets}>
            <FilterInput
              className={styles.filterInput}
              placeholder={t('secrets.search-placeholder', 'Search secret by name')}
              value={filter}
              onChange={(value) => setFilter(value)}
            />
          </InlineField>
        </div>

        {isError ? (
          <EmptyState
            variant="not-found"
            message={t('secrets.error-state.message', 'Something went wrong')}
            button={
              <Trans i18nKey="secrets.error-state.retry">
                <Button onClick={() => refetch()}>Retry</Button>
              </Trans>
            }
          >
            <Trans i18nKey="secrets.error-state.body" values={{ details: getErrorMessage(error) }}>
              <p>
                This may be due to poor network conditions or a potential plugin blocking requests. Retry, and if the
                problem persists, contact support.
              </p>
              <Box marginTop={1}>
                <Text color="error" italic>
                  Details: {'{{details}}'}
                </Text>
              </Box>
            </Trans>
          </EmptyState>
        ) : (
          <SecretsList
            onEditSecret={handleEditSecret}
            onDeleteSecret={deleteSecret}
            secrets={secrets}
            filter={filter}
            onCreateSecret={handleShowCreateModal}
          />
        )}

        {isEditModalOpen && <EditSecretModal isOpen onDismiss={handleDismissModal} name={editTarget} />}
      </PageContents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  filterInput: css({
    maxWidth: theme.spacing(50),
  }),
  tooltipContent: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  maxContrastText: css({
    color: theme.colors.text.maxContrast,
    weight: theme.typography.fontWeightMedium,
  }),
});
