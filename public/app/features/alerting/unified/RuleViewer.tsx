import React, { useState } from 'react';
import { Disable, Enable } from 'react-enable';
import { useParams } from 'react-router-dom';

import { Button, HorizontalGroup, withErrorBoundary } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaRuleInspector } from './components/rule-editor/GrafanaRuleInspector';
import { AlertingFeature } from './features';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

const DetailViewV1 = SafeDynamicImport(() => import('./components/rule-viewer/RuleViewer.v1'));
const DetailViewV2 = SafeDynamicImport(() => import('./components/rule-viewer/v2/RuleViewer.v2'));

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

const RuleViewer = (props: RuleViewerProps): JSX.Element => {
  const routeParams = useParams<{ type: string; id: string }>();
  const uidFromParams = routeParams.id;

  const sourceName = props.match.params.sourceName;

  const [showYaml, setShowYaml] = useState(false);
  const actionButtons =
    sourceName === GRAFANA_RULES_SOURCE_NAME ? (
      <HorizontalGroup height="auto" justify="flex-end">
        <Button variant="secondary" type="button" onClick={() => setShowYaml(true)} size="sm">
          View YAML
        </Button>
      </HorizontalGroup>
    ) : null;

  return (
    <AlertingPageWrapper>
      <AppChromeUpdate actions={actionButtons} />
      {showYaml && <GrafanaRuleInspector alertUid={uidFromParams} onClose={() => setShowYaml(false)} />}
      <Enable feature={AlertingFeature.DetailsViewV2}>
        <DetailViewV2 {...props} />
      </Enable>
      <Disable feature={AlertingFeature.DetailsViewV2}>
        <DetailViewV1 {...props} />
      </Disable>
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(RuleViewer, { style: 'page' });
