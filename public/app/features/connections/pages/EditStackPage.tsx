import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { EmptyState, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { Resource, GroupVersionResource } from 'app/features/apiserver/types';
import {
  StackForm,
  transformStackSpecToFormValues,
} from 'app/features/datasources/components/new-stack-form/StackForm';
import { StackFormValues } from 'app/features/datasources/components/new-stack-form/types';

import { DataSourceStackSpec } from './DataSourceStacksPage';

const datasourceStacksGVR: GroupVersionResource = {
  group: 'collections.grafana.app',
  version: 'v1alpha1',
  resource: 'datasourcestacks',
};

const datasourceStacksClient = new ScopedResourceClient<DataSourceStackSpec>(datasourceStacksGVR);

export function EditStackPage() {
  const { uid } = useParams<{ uid: string }>();
  const [stack, setStack] = useState<Resource<DataSourceStackSpec> | null>(null);
  const [formValues, setFormValues] = useState<StackFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStack = async () => {
      if (!uid) {
        setError('No stack UID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await datasourceStacksClient.get(uid);
        setStack(response);

        const values = transformStackSpecToFormValues(response.metadata.name || '', response.spec);
        setFormValues(values);
      } catch (err) {
        console.error('Failed to fetch datasource stack:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch datasource stack');
      } finally {
        setLoading(false);
      }
    };

    fetchStack();
  }, [uid]);

  const pageNav = {
    text: stack?.metadata.name
      ? t('connections.edit-stack-page.title-with-name', 'Edit {{name}}', { name: stack.metadata.name })
      : t('connections.edit-stack-page.title', 'Edit Data Source Stack'),
    subTitle: t('connections.edit-stack-page.subtitle', 'Modify your data source stack configuration'),
  };

  return (
    <Page navId="connections-stacks" pageNav={pageNav}>
      <Page.Contents>
        <EditStackContent loading={loading} error={error} formValues={formValues} />
      </Page.Contents>
    </Page>
  );
}

interface EditStackContentProps {
  loading: boolean;
  error: string | null;
  formValues: StackFormValues | null;
}

function EditStackContent({ loading, error, formValues }: EditStackContentProps) {
  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <EmptyState
        variant="not-found"
        message={t('connections.edit-stack-page.error', 'Failed to load data source stack')}
      >
        <div>{error}</div>
      </EmptyState>
    );
  }

  if (!formValues) {
    return (
      <EmptyState
        variant="not-found"
        message={t('connections.edit-stack-page.not-found', 'Data source stack not found')}
      />
    );
  }

  return <StackForm existing={formValues} />;
}
