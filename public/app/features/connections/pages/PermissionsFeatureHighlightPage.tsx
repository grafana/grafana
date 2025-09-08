import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, TextLink, useStyles2 } from '@grafana/ui';
import permissionsScreenshot from 'img/permissions-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage';

export function PermissionsFeatureHighlightPage() {
  const styles = useStyles2(getStyles);

  return (
    <FeatureHighlightsTabPage
      pageName="permissions"
      title={t("connections.permissions-feature-highlight-page.title", "Get started with data source permissions in Grafana Cloud")}
      header={t("connections.permissions-feature-highlight-page.header", "With data source permissions, you can protect sensitive data by limiting access to this data source to specific users, teams, and roles.")}
      items={[
        t("connections.permissions-feature-highlight-page.item-1", "Protect sensitive data, like security logs, production databases, and personally-identifiable information"),
        t("connections.permissions-feature-highlight-page.item-2", "Clean up users’ experience by hiding data sources they don’t need to use"),
        t("connections.permissions-feature-highlight-page.item-3", "Share Grafana access more freely, knowing that users will not unwittingly see sensitive data"),
      ]}
      footer={
        <div>
          <Trans i18nKey="connections.permissions-feature-highlight-page.footer">
            Create a Grafana Cloud Free account to start using data source permissions. This feature is also available
          with a Grafana Enterprise license.
          </Trans>
          <div>
            <TextLink href="https://grafana.com/docs/grafana/latest/introduction/grafana-enterprise/">
              <Icon name="external-link-alt" />
              <Trans i18nKey="connections.permissions-feature-highlight-page.footer-link">
                Learn about Enterprise
              </Trans>
            </TextLink>
          </div>
        </div>
      }
      linkButtonLabel={t("connections.permissions-feature-highlight-page.link-button-label", "Create account")}
      footNote={
        <div className={styles.footNote}>
          <Trans i18nKey="connections.permissions-feature-highlight-page.foot-note">
            After creating an account, you can have Grafana{' '}
            <TextLink href="">migrate this instance to Grafana Cloud</TextLink> with minimal effort.
          </Trans>
        </div>
      }
      screenshotPath={permissionsScreenshot}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
