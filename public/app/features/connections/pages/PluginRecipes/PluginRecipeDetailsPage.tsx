import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetSingle } from './api';
import { DetailsOverview, DetailsStatus, DetailsHeaderActions } from './components';
import { tabIds, usePluginRecipeDetailsPageTabs } from './hooks';
import { StepStatus } from './types';

const navId = 'connections-plugin-recipes';

export function PluginRecipeDetailsPage() {
  const params = useParams<{ id: string }>();
  const { status, error, data, refetch } = useGetSingle(params.id);
  const { tabId, tabs } = usePluginRecipeDetailsPageTabs(data);
  const styles = useStyles2(getStyles);
  const [isInstallStarted, setIsInstallStarted] = useState(false);
  const isInstalled = useMemo(
    () => (data ? data.steps.every((step) => step.status?.status === StepStatus.Completed) : false),
    [data]
  );
  const isInstallInProgress = useMemo(
    () =>
      data
        ? !isInstalled &&
          data.steps.some(
            (step) => step.status?.status === StepStatus.Completed || step.status?.status === StepStatus.Loading
          )
        : false,
    [data, isInstalled]
  );

  // Can be used to either start or continue an install process
  const onRunInstall = () => {
    setIsInstallStarted(true);
    // Find the steps that:
    //   - are not applied yet
    //   - can be auto-applied (without user-interaction)
    // Apply them sequentally

    // Instantiate a periodic refetch
    refetch();
  };

  // Some random options to be used in the header
  const info = [
    { label: 'Version', value: 'v1.0.0' },
    { label: 'Rating', value: '4/5' },
  ];

  // Loading recipe
  if (status === 'loading') {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>
          <LoadingPlaceholder text="Loading..." />
        </Page.Contents>
      </Page>
    );
  }

  // Error while loading recipe
  if (status === 'error') {
    return (
      <Page navId={navId} pageNav={{ text: 'Error', subTitle: '', active: true }}>
        <Page.Contents>
          <p>{String(error)}</p>
        </Page.Contents>
      </Page>
    );
  }

  // Not found
  if (status === 'success' && !data) {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>Plugin recipe not found.</Page.Contents>
      </Page>
    );
  }

  return (
    <Page
      navId={navId}
      pageNav={{ text: data.name, subTitle: data.meta.summary, active: true, children: tabs }}
      actions={
        <DetailsHeaderActions
          onInstall={onRunInstall}
          isInstalled={isInstalled}
          isInstallInProgress={isInstallInProgress}
          isInstallStarted={isInstallStarted} // TMP
        />
      }
      info={info}
      renderTitle={(title) => (
        <div className={styles.pageTitleContainer}>
          <img className={styles.pageTitleImage} src={data.meta.logo} alt={`Logo of ${data.name}`} />
          <h1 className={styles.pageTitle}>{title}</h1>
        </div>
      )}
    >
      <Page.Contents>
        <div className={styles.content}>
          {tabId === tabIds.overview && <DetailsOverview recipe={data} />}
          {tabId === tabIds.status && (
            <DetailsStatus
              recipe={data}
              isInstalled={isInstalled}
              isInstallStarted={isInstallStarted}
              onInstall={onRunInstall}
            />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = () => ({
  content: css`
    min-width: 900px;
    width: 60%;
  `,
  pageTitleContainer: css`
    display: flex;
    align-items: center;
  `,
  pageTitleImage: css`
    width: 40px;
    height: 40px;
    margin-left: 5px;
    margin-right: 10px;
  `,
  pageTitle: css`
    margin-bottom: 0;
  `,
});
