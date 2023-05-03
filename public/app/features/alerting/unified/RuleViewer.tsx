import { withErrorBoundary } from "@grafana/ui";
import { SafeDynamicImport } from "app/core/components/DynamicImports/SafeDynamicImport";
import { GrafanaRouteComponentProps } from "app/core/navigation/types";
import React from "react";
import { Disable, Enable } from "react-enable";
import { AlertingPageWrapper } from "./components/AlertingPageWrapper";

import { AlertingFeature } from "./features";

const DetailViewV1 = SafeDynamicImport(() => import("./components/rule-viewer/RuleViewer.v1"))
const DetailViewV2 = SafeDynamicImport(() => import("./components/rule-viewer/RuleViewer.v2"))

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string
  sourceName: string
}>;

const RuleViewer = (props: RuleViewerProps): JSX.Element => (
  <AlertingPageWrapper>
    <Enable feature={AlertingFeature.DetailsViewV2}>
      <DetailViewV2 {...props} />
    </Enable>
    <Disable feature={AlertingFeature.DetailsViewV2}>
      <DetailViewV1 {...props} />
    </Disable>
  </AlertingPageWrapper>
)

export default withErrorBoundary(RuleViewer, { style: 'page' });
