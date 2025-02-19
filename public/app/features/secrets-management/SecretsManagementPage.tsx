import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Button, EmptyState, FilterInput, InlineField, RadioButtonGroup } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';
import { Page } from 'app/core/components/Page/Page';
import { PageContents } from 'app/core/components/Page/PageContents';
import { useDispatch, useSelector } from 'app/types';

import { t } from '../../core/internationalization';

import { EditSecretModal } from './components/EditSecretModal';
import { SecretsList } from './components/SecretsList';
import { ZeroState } from './components/ZeroState';
import { MOCKED_FILTER_OPTIONS } from './constants';
import { fetchSecrets } from './state/actions';
import { selectSecretsManagementIsLoading, selectSecretsManagementSecrets } from './state/selectors';
import { Secret } from './types';

export default function SecretsManagementPage() {
  const subTitle = 'Manage secrets for use in Grafana';
  const docsLink = (
    <a
      className="external-link"
      href="https://grafana.com/docs/grafana/latest/administration/secrets-management/"
      target="_blank"
      rel="noopener noreferrer"
    >
      documentation
    </a>
  );

  const dispatch = useDispatch();

  const secrets = useSelector(selectSecretsManagementSecrets);
  const isLoading = useSelector(selectSecretsManagementIsLoading);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<undefined | string>();
  const [filter, setFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'enabled'>('all');

  const isEditModalOpen = !!editTarget || isCreateModalOpen;
  const styles = useStyles2(getStyles);

  const filteredSecrets: Secret[] = useMemo(() => {
    return secrets?.filter((secret) => secret.name.toLowerCase().includes(filter.toLowerCase()));
  }, [secrets, filter]);

  useEffect(() => {
    dispatch(fetchSecrets());
  }, [dispatch]);

  const hasSecrets = secrets && secrets.length > 0;

  const hasFilteredSecrets = filteredSecrets.length > 0;

  const handleCreateSecret = () => {
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
        <>
          {subTitle}. Find out more in our {docsLink}
        </>
      }
      actions={
        <div>
          <Button disabled={isLoading} icon="plus" onClick={handleCreateSecret}>
            Add secret
          </Button>
        </div>
      }
    >
      <PageContents isLoading={isLoading}>
        <div className={'page-action-bar'}>
          <InlineField grow>
            <FilterInput
              className={styles.filterInput}
              placeholder="Search secret by name"
              value={filter}
              onChange={(value) => setFilter(value)}
            />
          </InlineField>
          <Box marginBottom={1}>
            <RadioButtonGroup
              options={MOCKED_FILTER_OPTIONS}
              onChange={(value) => setStateFilter(value === 'enabled' ? 'enabled' : 'all')}
              value={stateFilter}
              disabledOptions={['disabled']}
            />
          </Box>
        </div>
        {!hasSecrets && <ZeroState onCreateSecret={handleCreateSecret} />}
        {hasSecrets && hasFilteredSecrets && <SecretsList onEditSecret={handleEditSecret} secrets={filteredSecrets!} />}
        {hasSecrets && !hasFilteredSecrets && (
          <EmptyState variant="not-found" message={t('secrets-management.search-result.not-found', 'No secrets found')}>
            Clear active filter to see all secrets.
          </EmptyState>
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
