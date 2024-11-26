import { Page } from 'app/core/components/Page/Page';

export default function RepositoryStatusPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Repository status', subTitle: 'Check the status of a configured repository.' }}
    >
      <Page.Contents>
        <div>Repository status</div>
      </Page.Contents>
    </Page>
  );
}
