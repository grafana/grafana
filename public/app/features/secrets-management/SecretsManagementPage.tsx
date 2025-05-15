import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterInput, InlineField, TextLink, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PageContents } from 'app/core/components/Page/PageContents';
import { Trans, t } from 'app/core/internationalization';

import { useListSecretsQuery, useDeleteSecretMutation } from './api/secretsManagementApi';
import { EditSecretModal } from './components/EditSecretModal';
import { SecretsEmptyState } from './components/SecretsEmptyState';
import { SecretsList } from './components/SecretsList';
import { Secret } from './types';

export default function SecretsManagementPage() {
  // Api test
  const { data: secrets, isLoading } = useListSecretsQuery();
  const [deleteSecret, { isLoading: isDeleting }] = useDeleteSecretMutation();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<undefined | string>();
  const [filter, setFilter] = useState('');

  const isEditModalOpen = !!editTarget || isCreateModalOpen;
  const styles = useStyles2(getStyles);

  const filteredSecrets: Secret[] = useMemo(() => {
    return secrets?.filter((secret) => secret.name.toLowerCase().includes(filter.toLowerCase())) ?? [];
  }, [secrets, filter]);

  const hasSecrets = secrets && secrets.length > 0;
  console.log('isDeleting', isDeleting);
  const hasFilteredSecrets = filteredSecrets.length > 0;

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
        <Trans i18nKey="secrets-management.page.sub-title">
          Manage secrets for use in Grafana. Find out more in our{' '}
          <TextLink href="https://grafana.com/docs/grafana/latest/administration/" external>
            documentation
          </TextLink>
        </Trans>
      }
      actions={
        hasSecrets && (
          <Button disabled={isLoading} icon="plus" onClick={handleShowCreateModal}>
            <Trans i18nKey="secrets-management.page.actions.create-secret">Create secret</Trans>
          </Button>
        )
      }
    >
      <PageContents isLoading={isLoading}>
        <div className="page-action-bar">
          <InlineField grow disabled={!hasSecrets}>
            <FilterInput
              className={styles.filterInput}
              placeholder={t('secrets-management.page.search.placeholder', 'Search secret by name')}
              value={filter}
              onChange={(value) => setFilter(value)}
            />
          </InlineField>
        </div>

        {!hasSecrets && <SecretsEmptyState onCreateSecret={handleShowCreateModal} />}

        {hasSecrets && hasFilteredSecrets && (
          <SecretsList
            onEditSecret={handleEditSecret}
            onDeleteSecret={deleteSecret}
            secrets={secrets}
            filter={filter}
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
