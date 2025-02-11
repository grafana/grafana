import { useCallback, useEffect, useState } from 'react';

import { Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PageContents } from 'app/core/components/Page/PageContents';
import { useDispatch, useSelector } from 'app/types';

import { CreateSecretModal } from './components/CreateSecretModal';
import { EditSecretModal } from './components/EditSecretModal';
import { SecretsList } from './components/SecretsList';
import { ZeroState } from './components/ZeroState';
import { fetchSecrets } from './state/actions';
import { selectSecretsManagementIsLoading, selectSecretsManagementSecrets } from './state/selectors';

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

  const list = useSelector(selectSecretsManagementSecrets);
  const isLoading = useSelector(selectSecretsManagementIsLoading);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<undefined | string>();
  const isEditModalOpen = !!editTarget;

  useEffect(() => {
    dispatch(fetchSecrets());
  }, [dispatch]);

  const hasSecrets = list && list.length > 0;
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
        {!hasSecrets && <ZeroState onCreateSecret={handleCreateSecret} />}
        {hasSecrets && <SecretsList onEditSecret={handleEditSecret} secrets={list!} />}
        {isCreateModalOpen && <CreateSecretModal isOpen onDismiss={handleDismissModal} />}
        {isEditModalOpen && <EditSecretModal isOpen onDismiss={handleDismissModal} name={editTarget} />}
      </PageContents>
    </Page>
  );
}
