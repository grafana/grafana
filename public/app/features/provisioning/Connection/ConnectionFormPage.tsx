import { skipToken } from '@reduxjs/toolkit/query/react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { EmptyState, Text, TextLink } from '@grafana/ui';
import { useGetConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { CONNECTIONS_URL } from '../constants';

import { ConnectionForm } from './ConnectionForm';

export default function ConnectionFormPage() {
  const { name = '' } = useParams();
  const isCreate = !name;

  const query = useGetConnectionQuery(isCreate ? skipToken : { name });

  //@ts-expect-error TODO add error types
  const notFound = !isCreate && query.isError && query.error?.status === 404;

  const pageTitle = isCreate
    ? t('provisioning.connection-form.page-title-create', 'Create connection')
    : t('provisioning.connection-form.page-title-edit', 'Edit connection');

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: pageTitle,
        subTitle: t(
          'provisioning.connection-form.page-subtitle',
          'Configure a connection to authenticate with external providers'
        ),
      }}
    >
      <Page.Contents isLoading={!isCreate && query.isLoading}>
        {notFound ? (
          <EmptyState message={t('provisioning.connection-form.not-found', 'Connection not found')} variant="not-found">
            <Text element="p">
              <Trans i18nKey="provisioning.connection-form.not-found-description">
                The connection you are looking for does not exist.
              </Trans>
            </Text>
            <TextLink href={CONNECTIONS_URL}>
              <Trans i18nKey="provisioning.connection-form.back-to-connections">Back to connections</Trans>
            </TextLink>
          </EmptyState>
        ) : (
          <ConnectionForm data={isCreate ? undefined : query.data} />
        )}
      </Page.Contents>
    </Page>
  );
}
