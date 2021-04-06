import React, { FC, useCallback, useEffect, useState } from 'react';
import { Button, HorizontalGroup, VerticalGroup } from '@grafana/ui';

import {
  getCollectorSanitizers,
  getCollectorWorkers,
  InspectCollector,
} from '../dashboard/components/Inspector/InspectCollector';
import { inspectDownloader, inspectPackager } from '../dashboard/components/Inspector/utils';
import { DashboardModel, PanelModel } from '../dashboard/state';
import { CopyToClipboard } from '../../core/components/CopyToClipboard/CopyToClipboard';
import appEvents from '../../core/app_events';
import { AppEvents } from '@grafana/data';
import { CollectorType } from '../dashboard/components/Inspector/types';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const InspectShareTab: FC<Props> = ({ dashboard, panel }) => {
  const [data, setData] = useState<string | undefined>(undefined);
  const runCollection = useCallback(async () => {
    setData(undefined);
    const items = await new InspectCollector().collect({
      dashboard,
      panel,
      workers: getCollectorWorkers(),
      sanitizers: getCollectorSanitizers(),
      type: CollectorType.Panel,
    });

    const data = inspectPackager().package(items);
    setData(data);
    return data;
  }, [dashboard, panel]);
  useEffect(() => {
    runCollection();
  }, [runCollection]);

  const onDownloadClick = () => {
    if (data) {
      inspectDownloader().startDownload(data);
    }
  };

  const onClipboardSuccess = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Sanitized data copied to clipboard']);
  };

  return (
    <VerticalGroup>
      <h3 className="section-heading">Sharing data</h3>
      <p className="small muted">
        This section simplifies sharing of data back to Grafana Labs when reporting an issue.
      </p>
      {!Boolean(data) ? <span>Collecting...</span> : null}
      {Boolean(data) ? (
        <HorizontalGroup>
          <Button type="button" icon="download-alt" onClick={onDownloadClick}>
            Download sanitized data
          </Button>
          <CopyToClipboard text={() => data ?? ''} onSuccess={onClipboardSuccess} elType="div">
            <Button type="button" icon="clipboard-alt" variant="secondary">
              Copy sanitized data to clipboard
            </Button>
          </CopyToClipboard>
        </HorizontalGroup>
      ) : null}
    </VerticalGroup>
  );
};
