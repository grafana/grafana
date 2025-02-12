import { Card } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { Job, Repository, useGetFrontendSettingsQuery } from './api';
import { useRepositoryJobs, useRepositoryList } from './hooks';

type step = 'config' | 'export' | 'import' | 'done' | 'error';

export default function SetupWizardPage() {
  const [repos, isLoading] = useRepositoryList({ watch: true });
  const [jobs] = useRepositoryJobs({ watch: true });
  const settings = useGetFrontendSettingsQuery();
  const step = getStep(settings.currentData?.legacyStorage, repos, jobs);

  console.log('WIZARD', repos, settings);

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup wizard', subTitle: 'Migrate this instance to git provisioning' }}
    >
      <Page.Contents isLoading={isLoading}>
        <ul
          style={{
            listStyle: 'none',
            display: 'grid',
          }}
        >
          <li style={step === 'config' ? { border: '1px solid red' } : {}}>
            <Card>
              <Card.Heading>Connect to github repository</Card.Heading>
              <Card.Description>
                <ol>
                  <li>Enter git url</li>
                  <li>Enter access token</li>
                  <li>Enter Branch</li>
                </ol>
              </Card.Description>
            </Card>
          </li>
          <li style={step === 'export' ? { border: '1px solid red' } : {}}>
            <Card>
              <Card.Heading>Export resources</Card.Heading>
              <Card.Description>
                <ol>
                  <li>with history?</li>
                  <li>keep existing identifiers?</li>
                  <li>[NEXT]</li>
                  <li>[WATCH until done]</li>
                </ol>
              </Card.Description>
            </Card>
          </li>
          <li style={step === 'import' ? { border: '1px solid red' } : {}}>
            <Card>
              <Card.Heading>Import resources</Card.Heading>
              <Card.Description>
                <ol>
                  <li>warning that this will replace</li>
                  <li>[NEXT]</li>
                  <li>[WATCH until done]</li>
                </ol>
              </Card.Description>
            </Card>
          </li>
          {step === 'done' && (
            <li style={{ border: '1px solid red' }}>
              <Card>
                <Card.Heading>Done</Card.Heading>
                <Card.Description>
                  <ol>
                    <li>repository exists</li>
                    <li>things have been imported</li>
                  </ol>
                </Card.Description>
              </Card>
            </li>
          )}
          {step === 'error' && (
            <li style={{ border: '1px solid red' }}>
              <Card>
                <Card.Heading>Error</Card.Heading>
                <Card.Description>
                  <ol>
                    <li>some other case we can't help with?</li>
                  </ol>
                </Card.Description>
              </Card>
            </li>
          )}
        </ul>
        <div>STEP: {step}</div>
      </Page.Contents>
    </Page>
  );
}

function getStep(legacyStorage?: boolean, repos?: Repository[], jobs?: Job[]): step {
  if (!repos?.length) {
    return 'config';
  }
  const repo = repos[0];
  if (!repo.status?.health.healthy) {
    return 'config';
  }

  if (!jobs?.length) {
    return 'export';
  }

  //  const exportJob = jobs.find((j) => j.spec?.action === 'export' && j.spec.repository === repo.metadata?.name)
  const importJob = jobs.find((j) => j.spec?.action === 'sync' && j.spec.repository === repo.metadata?.name);

  if (importJob) {
    if (importJob.status?.finished) {
      return 'done';
    }
    return 'import';
  }

  return 'export';
}
