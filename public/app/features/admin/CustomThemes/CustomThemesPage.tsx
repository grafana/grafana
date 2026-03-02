import { Trans, t } from '@grafana/i18n';
import { EmptyState, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

export default function CustomThemesPage() {
  return (
    <Page
      navId="custom-themes"
      actions={
        <LinkButton icon="plus" href="/themes/new">
          <Trans i18nKey="admin.custom-themes.add-button">Add custom theme</Trans>
        </LinkButton>
      }
    >
      <Page.Contents>
        <EmptyState
          variant="call-to-action"
          button={
            <LinkButton icon="plus" href="/themes/new" size="lg">
              <Trans i18nKey="admin.custom-themes.add-button">Add custom theme</Trans>
            </LinkButton>
          }
          message={t('admin.custom-themes.empty-state', 'No custom themes')}
        >
          <Trans i18nKey="admin.custom-themes.empty-state-description">
            Add a custom theme to apply a unique look and feel to your organization.
          </Trans>
        </EmptyState>
      </Page.Contents>
    </Page>
  );
}
