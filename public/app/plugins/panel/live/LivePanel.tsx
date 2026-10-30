import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { memo, useEffect, useState } from 'react';

import {
  type GrafanaTheme2,
  type PanelProps,
  type LiveChannelStatusEvent,
  isValidLiveChannelAddress,
  isLiveChannelStatusEvent,
  isLiveChannelMessageEvent,
  LiveChannelConnectionState,
  type PanelData,
  LoadingState,
  applyFieldOverrides,
  type LiveChannelAddress,
  StreamingDataFrame,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, JSONFormatter, useStyles2, ScrollContainer } from '@grafana/ui';

import { TablePanel } from '../table/TablePanel';

import { LivePublish } from './LivePublish';
import { type LivePanelOptions, MessageDisplayMode, MessagePublishMode } from './types';

interface Props extends PanelProps<LivePanelOptions> {}

export const LivePanel = memo((props: Props) => {
  const { options, height, onOptionsChange, timeRange } = props;
  const styles = useStyles2(getStyles);
  const [channel, setChannel] = useState<LiveChannelAddress | undefined>(options.channel);
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState<LiveChannelStatusEvent>();
  const [message, setMessage] = useState<unknown>();

  // options.channel can be a new but equal object, which shouldn't resubscribe
  if (!isEqual(options.channel, channel)) {
    setChannel(options.channel);
  }

  const live = getGrafanaLiveSrv();
  const addr = isValidLiveChannelAddress(channel) ? channel : undefined;

  useEffect(() => {
    if (!live || !addr) {
      return undefined;
    }

    try {
      const subscription = live.getStream(addr).subscribe({
        next: (event) => {
          if (isLiveChannelStatusEvent(event)) {
            setStatus(event);
          } else if (isLiveChannelMessageEvent(event)) {
            setMessage(event.message);
          } else {
            console.log('ignore', event);
          }
        },
      });
      setError(undefined);
      return () => subscription.unsubscribe();
    } catch (err) {
      setError(err);
      return undefined;
    }
  }, [live, addr]);

  if (!live) {
    const preformatted = `[feature_toggles]
    enable = live`;
    return (
      <Alert title={t('live.live-panel.title-grafana-live', 'Grafana Live')} severity="info">
        <p>
          <Trans i18nKey="live.live-panel.grafana-requires-feature">Grafana live requires a feature flag to run</Trans>
        </p>

        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <b>custom.ini:</b>
        <pre>{preformatted}</pre>
      </Alert>
    );
  }

  if (!addr) {
    return (
      <Alert title={t('live.live-panel.title-grafana-live', 'Grafana Live')} severity="info">
        <Trans i18nKey="live.live-panel.panel-editor-channel">Use the panel editor to pick a channel</Trans>
      </Alert>
    );
  }

  if (error) {
    return (
      <div>
        <h2>
          <Trans i18nKey="live.live-panel.error">Error</Trans>
        </h2>
        <div>{JSON.stringify(error)}</div>
      </div>
    );
  }

  const renderMessage = (height: number) => {
    if (!message) {
      return (
        <div>
          <h4>
            <Trans i18nKey="live.live-panel.waiting-for-data">Waiting for data:</Trans>
          </h4>
          {options.channel?.scope}/{options.channel?.stream}/{options.channel?.path}
        </div>
      );
    }

    if (options.display === MessageDisplayMode.JSON) {
      return <JSONFormatter json={message} open={5} />;
    }

    if (options.display === MessageDisplayMode.Auto) {
      if (message instanceof StreamingDataFrame) {
        const data: PanelData = {
          series: applyFieldOverrides({
            data: [message],
            theme: config.theme2,
            replaceVariables: (v: string) => v,
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
          }),
          state: LoadingState.Streaming,
          timeRange,
        };
        const tableProps: PanelProps = {
          ...props,
          options: { frameIndex: 0, showHeader: true },
        };
        return <TablePanel {...tableProps} data={data} height={height} />;
      }
    }

    return <pre>{JSON.stringify(message)}</pre>;
  };

  const renderPublish = (height: number) => (
    <LivePublish
      height={height}
      body={options.message}
      mode={options.publish ?? MessagePublishMode.JSON}
      onSave={(message) => onOptionsChange({ ...options, message })}
      addr={addr}
    />
  );

  const renderStatus = () => {
    if (status?.state === LiveChannelConnectionState.Connected) {
      return; // nothing
    }

    let statusClass = '';
    if (status) {
      statusClass = styles.status[status.state];
    }
    return <div className={cx(statusClass, styles.statusWrap)}>{status?.state}</div>;
  };

  const renderBody = () => {
    const publish = options.publish === MessagePublishMode.JSON || options.publish === MessagePublishMode.Influx;

    if (publish) {
      if (options.display === MessageDisplayMode.None) {
        return renderPublish(height);
      }

      // Both message and publish
      const halfHeight = height / 2;
      return (
        <div>
          <div style={{ height: halfHeight, overflow: 'hidden' }}>
            <ScrollContainer>{renderMessage(halfHeight)}</ScrollContainer>
          </div>
          <div>{renderPublish(halfHeight)}</div>
        </div>
      );
    }
    if (options.display === MessageDisplayMode.None) {
      return <pre>{JSON.stringify(status)}</pre>;
    }

    // Only message
    return (
      <div style={{ overflow: 'hidden', height }}>
        <ScrollContainer>{renderMessage(height)}</ScrollContainer>
      </div>
    );
  };

  return (
    <>
      {renderStatus()}
      {renderBody()}
    </>
  );
});

LivePanel.displayName = 'LivePanel';

const getStyles = (theme: GrafanaTheme2) => ({
  statusWrap: css({
    margin: 'auto',
    position: 'absolute',
    top: 0,
    right: 0,
    background: theme.components.panel.background,
    padding: '10px',
    zIndex: theme.zIndex.modal,
  }),
  status: {
    [LiveChannelConnectionState.Pending]: css({
      border: `1px solid ${theme.v1.palette.orange}`,
    }),
    [LiveChannelConnectionState.Connected]: css({
      border: `1px solid ${theme.colors.success.main}`,
    }),
    [LiveChannelConnectionState.Connecting]: css({
      border: `1px solid ${theme.v1.palette.brandWarning}`,
    }),
    [LiveChannelConnectionState.Disconnected]: css({
      border: `1px solid ${theme.colors.warning.main}`,
    }),
    [LiveChannelConnectionState.Shutdown]: css({
      border: `1px solid ${theme.colors.error.main}`,
    }),
    [LiveChannelConnectionState.Invalid]: css({
      border: '1px solid red',
    }),
  },
});
