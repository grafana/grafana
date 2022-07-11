import React, { useEffect, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Button, CodeEditor, HorizontalGroup, LinkButton } from '@grafana/ui';

import { StorageView } from './types';

export const EXPORT_LOCAL_STORAGE_KEY = 'grafana.export.config';

interface ExportStatusMessage {
  running: boolean;
  target: string;
  started: number;
  finished: number;
  update: number;
  count: number;
  current: number;
  last: string;
  status: string;
}

interface ExportInclude {
  auth: boolean;
  ds: boolean;
  dash: boolean;
  services: boolean;
  usage: boolean;
  anno: boolean;
  snapshots: boolean;
}

interface ExportJob {
  format: 'git';
  generalFolderPath: string;
  history: boolean;
  include: ExportInclude;

  git?: {};
}

const includAll: ExportInclude = {
  auth: true,
  ds: true,
  dash: true,
  services: true,
  usage: true,
  anno: true,
  snapshots: false, // will fail until we have a real user
};

const defaultJob: ExportJob = {
  format: 'git',
  generalFolderPath: 'general',
  history: true,
  include: includAll,
  git: {},
};

interface Props {
  onPathChange: (p: string, v?: StorageView) => void;
}

export const ExportView = ({ onPathChange }: Props) => {
  const [status, setStatus] = useState<ExportStatusMessage>();
  const [rawBody, setBody] = useLocalStorage<ExportJob>(EXPORT_LOCAL_STORAGE_KEY, defaultJob);
  const body = { ...defaultJob, ...rawBody, include: { ...includAll, ...rawBody?.include } };

  const doStart = () => {
    getBackendSrv().post('/api/admin/export', body);
  };
  const doStop = () => {
    getBackendSrv().post('/api/admin/export/stop');
  };

  useEffect(() => {
    const subscription = getGrafanaLiveSrv()
      .getStream<ExportStatusMessage>({
        scope: LiveChannelScope.Grafana,
        namespace: 'broadcast',
        path: 'export',
      })
      .subscribe({
        next: (evt) => {
          if (isLiveChannelMessageEvent(evt)) {
            setStatus(evt.message);
          } else if (isLiveChannelStatusEvent(evt)) {
            setStatus(evt.message);
          }
        },
      });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {status && (
        <div>
          <h3>Status</h3>
          <pre>{JSON.stringify(status, null, 2)}</pre>
          {status.running && (
            <div>
              <Button variant="secondary" onClick={doStop}>
                Stop
              </Button>
            </div>
          )}
        </div>
      )}

      {!Boolean(status?.running) && (
        <div>
          <h3>Export grafana instance</h3>
          <CodeEditor
            height={275}
            value={JSON.stringify(body, null, 2) ?? ''}
            showLineNumbers={false}
            readOnly={false}
            language="json"
            showMiniMap={false}
            onBlur={(text: string) => {
              setBody(JSON.parse(text)); // force JSON?
            }}
          />
          <br />

          <HorizontalGroup>
            <Button onClick={doStart} variant="primary">
              Export
            </Button>
            <LinkButton href="admin/storage/" variant="secondary">
              Cancel
            </LinkButton>
          </HorizontalGroup>
        </div>
      )}
    </div>
  );
};
