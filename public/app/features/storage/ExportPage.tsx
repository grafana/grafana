import React, { useEffect, useState, useCallback } from 'react';
import { useAsync, useLocalStorage } from 'react-use';

import { isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope, SelectableValue } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv, config } from '@grafana/runtime';
import {
  Button,
  CodeEditor,
  Collapse,
  Field,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  LinkButton,
  Select,
  Switch,
  Alert,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

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

interface ExportJob {
  format: string; // 'git';
  generalFolderPath: string;
  history: boolean;
  exclude: Record<string, boolean>;

  git?: {};
}

const defaultJob: ExportJob = {
  format: 'git',
  generalFolderPath: 'general',
  history: true,
  exclude: {},
  git: {},
};

interface ExporterInfo {
  key: string;
  name: string;
  description: string;
  children?: ExporterInfo[];
}

enum StorageFormat {
  Git = 'git',
  EntityStore = 'entityStore',
}

const formats: Array<SelectableValue<string>> = [
  { label: 'GIT', value: StorageFormat.Git, description: 'Exports a fresh git repository' },
  { label: 'Entity store', value: StorageFormat.EntityStore, description: 'Export to the SQL based entity store' },
];

interface Props extends GrafanaRouteComponentProps {}

const labelWith = 18;

export default function ExportPage(props: Props) {
  const navModel = useNavModel('export');
  const [status, setStatus] = useState<ExportStatusMessage>();
  const [body, setBody] = useLocalStorage<ExportJob>(EXPORT_LOCAL_STORAGE_KEY, defaultJob);
  const [details, setDetails] = useState(false);

  const serverOptions = useAsync(() => {
    return getBackendSrv().get<{ exporters: ExporterInfo[] }>('/api/admin/export/options');
  }, []);

  const doStart = () => {
    getBackendSrv()
      .post('/api/admin/export', body)
      .then((v) => {
        if (v.cfg && v.status.running) {
          setBody(v.cfg); // saves the valid parsed body
        }
      });
  };

  const doStop = () => {
    getBackendSrv().post('/api/admin/export/stop');
  };

  const setInclude = useCallback(
    (k: string, v: boolean) => {
      if (!serverOptions.value || !body) {
        return;
      }
      const exclude: Record<string, boolean> = {};
      if (k === '*') {
        if (!v) {
          for (let exp of serverOptions.value.exporters) {
            exclude[exp.key] = true;
          }
        }
        setBody({ ...body, exclude });
        return;
      }

      for (let exp of serverOptions.value.exporters) {
        let val = body.exclude?.[exp.key];
        if (k === exp.key) {
          val = !v;
        }
        if (val) {
          exclude[exp.key] = val;
        }
      }
      setBody({ ...body, exclude });
    },
    [body, setBody, serverOptions]
  );

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

  const renderView = () => {
    const isEntityStoreEnabled = body?.format === StorageFormat.EntityStore && config.featureToggles.entityStore;
    const shouldDisplayContent = isEntityStoreEnabled || body?.format === StorageFormat.Git;

    const statusFragment = status && (
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
    );

    const formFragment = !Boolean(status?.running) && (
      <div>
        <Field label="Format">
          <Select
            options={formats}
            width={40}
            value={formats.find((v) => v.value === body?.format)}
            onChange={(v) => setBody({ ...body!, format: v.value! })}
          />
        </Field>
        {!isEntityStoreEnabled && body?.format !== StorageFormat.Git && (
          <div>
            <Alert title="Missing feature flag">Enable the `entityStore` feature flag</Alert>
          </div>
        )}
        {body?.format === StorageFormat.Git && (
          <>
            <Field label="Keep history">
              <Switch value={body?.history} onChange={(v) => setBody({ ...body!, history: v.currentTarget.checked })} />
            </Field>

            <Field label="Include">
              <>
                <InlineFieldRow>
                  <InlineField label="Toggle all" labelWidth={labelWith}>
                    <InlineSwitch
                      value={Object.keys(body?.exclude ?? {}).length === 0}
                      onChange={(v) => setInclude('*', v.currentTarget.checked)}
                    />
                  </InlineField>
                </InlineFieldRow>
                {serverOptions.value && (
                  <div>
                    {serverOptions.value.exporters.map((ex) => (
                      <InlineFieldRow key={ex.key}>
                        <InlineField label={ex.name} labelWidth={labelWith} tooltip={ex.description}>
                          <InlineSwitch
                            value={body?.exclude?.[ex.key] !== true}
                            onChange={(v) => setInclude(ex.key, v.currentTarget.checked)}
                          />
                        </InlineField>
                      </InlineFieldRow>
                    ))}
                  </div>
                )}
              </>
            </Field>
          </>
        )}

        {shouldDisplayContent && (
          <>
            <Field label="General folder" description="Set the folder name for items without a real folder">
              <Input
                width={40}
                value={body?.generalFolderPath ?? ''}
                onChange={(v) => setBody({ ...body!, generalFolderPath: v.currentTarget.value })}
                placeholder="root folder path"
              />
            </Field>

            <HorizontalGroup>
              <Button onClick={doStart} variant="primary">
                Export
              </Button>
              <LinkButton href="admin/storage/" variant="secondary">
                Cancel
              </LinkButton>
            </HorizontalGroup>
          </>
        )}
      </div>
    );

    const requestDetailsFragment = (isEntityStoreEnabled || body?.format === StorageFormat.Git) && (
      <Collapse label="Request details" isOpen={details} onToggle={setDetails} collapsible={true}>
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
      </Collapse>
    );

    return (
      <div>
        {statusFragment}
        {formFragment}
        <br />
        <br />
        {requestDetailsFragment}
      </div>
    );
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>{renderView()}</Page.Contents>
    </Page>
  );
}
