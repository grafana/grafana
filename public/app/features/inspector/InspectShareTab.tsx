import React, { useState } from 'react';
import { useAsync } from 'react-use';
import { css } from '@emotion/css';
import { AppEvents, FeatureState, GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, FeatureBadge, Field, HorizontalGroup, Switch, useStyles2, VerticalGroup } from '@grafana/ui';

import {
  getCollectorSanitizers,
  getCollectorWorkers,
  InspectCollector,
} from '../dashboard/components/Inspector/InspectCollector';
import { inspectDownloader, inspectPackager } from '../dashboard/components/Inspector/utils';
import { DashboardModel, PanelModel } from '../dashboard/state';
import { CopyToClipboard } from '../../core/components/CopyToClipboard/CopyToClipboard';
import appEvents from '../../core/app_events';
import { CollectorType, Sanitizer } from '../dashboard/components/Inspector/types';

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
  const styles = useStyles2(getStyles);

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
        <p>Even though we work hard to minimize errors in Grafana they sometimes appear.</p>
        <p>
          Making an error disappear involves
          <a href="https://github.com/grafana/grafana/issues/new/choose" target="_blank" rel="noopener noreferrer">
            &nbsp;creating an issue on GitHub&nbsp;
          </a>
          and then adding enough information and reproducible steps to make the investigation and fixing the error a
          breeze.
        </p>
        <p>
          This feature will collect information about your <em>OS</em>, <em>Browser</em>, <em>Grafana</em>,&nbsp;
          <em>Dashboard</em> & <em>Panel</em> and package it in such a way that it will make it easier for you to attach
          the essential information needed when reporting an issue. The collected data is only available on this page
          and is not shared or stored in any way.
        </p>
        <p>
          <em>
            Make sure you remove any sensitive data before you attach it to any issue as it will become public to
            everyone.
          </em>
        </p>
      </Alert>
      <div className={styles.sanitizeContainer}>
        <Field
          label="Sanitize data"
          description={
            <span>
              Replaces sensitive information in the collected data with <em>******</em>
            </span>
          }
        >
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
        <div className={styles.featureBadge}>
          <FeatureBadge featureState={FeatureState.alpha} />
        </div>
      </div>
      <HorizontalGroup>
        <Button type="button" icon="download-alt" onClick={onDownloadClick} variant="secondary">
          Download shared data
        </Button>
        <CopyToClipboard text={() => value ?? ''} onSuccess={onClipboardSuccess} elType="div">
          <Button type="button" icon="clipboard-alt">
            Copy shared data to clipboard
          </Button>
        </CopyToClipboard>
      </HorizontalGroup>
    </VerticalGroup>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sanitizeContainer: css`
      display: flex;
    `,
    featureBadge: css`
      align-self: start;
      padding: ${theme.spacing(0, 1)};
    `,
  };
}

function LoadingIndicator(): JSX.Element {
  return <span>Collecting...</span>;
}
