import { Page } from 'app/core/components/Page/Page';
import { StackForm } from 'app/features/datasources/components/new-stack-form/StackForm';

export function NewStackPage() {
  return (
    <Page
      navId={'connections-datasources'}
      pageNav={{
        text: 'New Data Source Stack',
        subTitle: 'Add a new data source stack',
        active: true,
      }}
    >
      <Page.Contents>
        <StackForm />
      </Page.Contents>
    </Page>
  );
}
