import React, { useState } from 'react';
import { Alert, Button, FeatureBadge, Field, HorizontalGroup, Switch, VerticalGroup } from '@grafana/ui';

import {
  getCollectorSanitizers,
  getCollectorWorkers,
  InspectCollector,
} from '../dashboard/components/Inspector/InspectCollector';
import { inspectDownloader, inspectPackager } from '../dashboard/components/Inspector/utils';
import { DashboardModel, PanelModel } from '../dashboard/state';
import { CopyToClipboard } from '../../core/components/CopyToClipboard/CopyToClipboard';
import appEvents from '../../core/app_events';
import { AppEvents, FeatureState } from '@grafana/data';
import { CollectorType, Sanitizer } from '../dashboard/components/Inspector/types';
import { useAsync } from 'react-use';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export function InspectShareTab({ dashboard, panel }: Props): JSX.Element {
  const [sanitizers, setSanitizers] = useState<Sanitizer[]>([]);
  const { loading, value } = useAsync<string | undefined>(async () => {
    const items = await new InspectCollector().collect({
      dashboard,
      panel,
      workers: getCollectorWorkers(),
      sanitizers,
      type: CollectorType.Panel,
    });

    return inspectPackager().package(items);
  }, [dashboard, panel, sanitizers]);

  const onDownloadClick = () => {
    if (value) {
      inspectDownloader().startDownload(value);
    }
  };

  const onClipboardSuccess = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Shared data copied to clipboard']);
  };

  if (loading || !Boolean(value)) {
    return <LoadingIndicator />;
  }

  return (
    <VerticalGroup>
      <Alert title="Sharing data" severity="info">
        <p>
          Even though we work hard to minimize errors in Grafana sometimes they appear. Making an error disappear
          involves reporting the error
          <a href="https://github.com/grafana/grafana/issues/new/choose">&nbsp;by creating an issue first&nbsp;</a>
          and then adding enough information and reproducible steps to make the investigation and fixing the error a
          breeze.
          <br />
          <br />
          We think this feature will make it easier for you to attach the essential information needed for us to fix an
          issue.
          <br />
          <br />
          <em>
            Make sure you sanitize any sensitive data before you attach it to any issue as it will become public to
            everyone.
          </em>
        </p>
      </Alert>
      <HorizontalGroup>
        <Field label="Sanitize data" description="Replaces all sensitive information in the collected data with ******">
          <Switch
            value={Boolean(sanitizers.length)}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                setSanitizers(getCollectorSanitizers());
              } else {
                setSanitizers([]);
              }
            }}
          />
        </Field>
        <FeatureBadge featureState={FeatureState.alpha} />
      </HorizontalGroup>
      <HorizontalGroup>
        <Button type="button" icon="download-alt" onClick={onDownloadClick}>
          Download shared data
        </Button>
        <CopyToClipboard text={() => value ?? ''} onSuccess={onClipboardSuccess} elType="div">
          <Button type="button" icon="clipboard-alt" variant="secondary">
            Copy shared data to clipboard
          </Button>
        </CopyToClipboard>
      </HorizontalGroup>
    </VerticalGroup>
  );
}

function LoadingIndicator(): JSX.Element {
  return <span>Collecting...</span>;
}
