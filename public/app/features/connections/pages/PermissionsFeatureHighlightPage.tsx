/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, TextLink, useStyles2 } from "@grafana/ui";
import permissionsScreenshot from 'img/permission-screenshot.png';

import { FeatureHighlightsTabPage } from "../components/FeatureHighlightsTabPage";

export function PermissionsFeatureHighlightPage() {

  const styles = useStyles2(getStyles);

  return (
    <FeatureHighlightsTabPage
      pageName="permissions"
      title="Get started with data source permissions in Grafana Cloud"
      header="With data source permissions, you can protect sensitive data by limiting access to this data source to specific users, teams, and roles."
      items={[
        "Protect sensitive data, like security logs, production databases, and personally-identifiable information",
        "Clean up users’ experience by hiding data sources they don’t need to use",
        "Share Grafana access more freely, knowing that users will not unwittingly see sensitive data",
      ]}
      footer={<div>
        Create a Grafana Cloud Free account to start using data source permissions.
        This feature is also available with a Grafana Enterprise license.
        <div>
          <TextLink href="https://grafana.com/docs/grafana/latest/introduction/grafana-enterprise/">
            <Icon name="external-link-alt" />
            Learn about Enterprise
          </TextLink>
        </div>
      </div>}
      linkButtonLabel="Create account"
      footNote={<div className={styles.footNote}>
        After creating an account, you can have Grafana <TextLink href="">migrate this instance to Grafana Cloud</TextLink> with minimal effort.
      </div>}
      screenshotPath={permissionsScreenshot} />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
