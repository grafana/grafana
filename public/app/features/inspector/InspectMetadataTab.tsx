import React from 'react';

import { DataSourceApi, PanelData } from '@grafana/data';
import { Trans } from 'app/core/internationalization';

interface InspectMetadataTabProps {
  data: PanelData;
  metadataDatasource?: DataSourceApi;
}
export const InspectMetadataTab = ({ data, metadataDatasource }: InspectMetadataTabProps) => {
  if (!metadataDatasource || !metadataDatasource.components?.MetadataInspector) {
    return <Trans i18nKey="dashboard.inspect-meta.no-inspector">No Metadata Inspector</Trans>;
  }
  return <metadataDatasource.components.MetadataInspector datasource={metadataDatasource} data={data.series} />;
};
