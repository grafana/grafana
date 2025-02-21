import { Card, EmptyState, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from './SetupWarnings';
import { RepositoryViewList } from './api';
import { NEW_URL, PROVISIONING_URL } from './constants';

interface OnboardingPageProps {
  settings?: RepositoryViewList;
}

export default function OnboardingPage({ settings }: OnboardingPageProps) {
  const renderOptions = () => {
    if (settings?.legacyStorage) {
      return (
        <Card href={`${PROVISIONING_URL}/migrate`}>
          <Card.Heading>Migrate instance</Card.Heading>
          <Card.Description>
            Move all dashbaords from their current storage into a provisioning source and use that to manage
          </Card.Description>
        </Card>
      );
    }

    return (
      <EmptyState
        variant="call-to-action"
        message="You haven't created any repository configs yet"
        button={
          <LinkButton icon="plus" href={NEW_URL} size="lg">
            Create repository config
          </LinkButton>
        }
      />
    );
  };

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup provisioning', subTitle: 'Configure this instance to use provisioning' }}
    >
      <Page.Contents>
        <SetupWarnings />
        {renderOptions()}
      </Page.Contents>
    </Page>
  );
}
