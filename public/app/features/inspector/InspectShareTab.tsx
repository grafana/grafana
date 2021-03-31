import React, { FC } from 'react';
import { Button, HorizontalGroup, VerticalGroup } from '@grafana/ui';

import {
  CollectorType,
  getCollectorSanitizers,
  getCollectorWorkers,
  InspectCollector,
} from '../dashboard/components/Inspector/InspectCollector';
import { inspectDownloader, inspectPackager } from '../dashboard/components/Inspector/utils';
import { DashboardModel, PanelModel } from '../dashboard/state';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const InspectShareTab: FC<Props> = ({ dashboard, panel }) => {
  const runCollection = async () => {
    const items = await new InspectCollector().collect({
      dashboard,
      panel,
      workers: getCollectorWorkers(),
      sanitizers: getCollectorSanitizers(),
      type: CollectorType.Panel,
    });

    return items;
  };

  const onDownloadClick = async () => {
    const items = await runCollection();
    const data = inspectPackager().package(items);
    inspectDownloader().startDownload(data);
  };

  return (
    <VerticalGroup>
      <h3 className="section-heading">Sharing data</h3>
      <p className="small muted">
        This section simplifies sharing of data back to Grafana Labs when reporting an issue.
      </p>
      <HorizontalGroup>
        <Button type="button" icon="download-alt" onClick={onDownloadClick}>
          Download sanitized data
        </Button>
      </HorizontalGroup>
    </VerticalGroup>
  );
};
