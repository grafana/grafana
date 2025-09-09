import { Trans } from "@grafana/i18n";
import { Icon, TextLink } from "@grafana/ui";

export function Footer() {
   return (
        <div>
          <Trans i18nKey="connections.feature-highlight-page.footer">
            Create a Grafana Cloud Free account to start using data source permissions. This feature is also available
            with a Grafana Enterprise license.
          </Trans>
          <div>
            <TextLink href="https://grafana.com/products/enterprise/grafana/">
              <Icon name="external-link-alt" />
              <Trans i18nKey="connections.feature-highlight-page.footer-link">Learn about Enterprise</Trans>
            </TextLink>
          </div>
        </div>
   );
}
