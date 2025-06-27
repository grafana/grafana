import { Page } from "app/core/components/Page/Page";
import { UpgradeGrafanaBody } from "./UpgradeGrafanaBody";

export default function UpgradeGrafanaPage() {
  return (
    <Page navId="upgrade-grafana">
        <Page.Contents>
        <UpgradeGrafanaBody />
      </Page.Contents>
    </Page>
  );
}
