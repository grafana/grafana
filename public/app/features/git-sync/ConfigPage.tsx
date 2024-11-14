import { Page } from '../../core/components/Page/Page';

export default function ConfigPage() {
  return (
    <Page navId="git-sync" subTitle="Store and version control your resources">
      <Page.Contents isLoading={false}>
        <div>Config page</div>
      </Page.Contents>
    </Page>
  );
}
