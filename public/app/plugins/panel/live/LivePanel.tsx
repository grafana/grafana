import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { PureComponent } from 'react';
import { Unsubscribable, PartialObserver } from 'rxjs';

import {
  GrafanaTheme2,
  PanelProps,
  LiveChannelStatusEvent,
  isValidLiveChannelAddress,
  LiveChannelEvent,
  isLiveChannelStatusEvent,
  isLiveChannelMessageEvent,
  LiveChannelConnectionState,
  PanelData,
  LoadingState,
  applyFieldOverrides,
  LiveChannelAddress,
  StreamingDataFrame,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';
import { Alert, stylesFactory, JSONFormatter, CustomScrollbar } from '@grafana/ui';

import { TablePanel } from '../table/TablePanel';

import { LivePublish } from './LivePublish';
import { LivePanelOptions, MessageDisplayMode, MessagePublishMode } from './types';

interface Props extends PanelProps<LivePanelOptions> {}

interface State {
  error?: unknown;
  addr?: LiveChannelAddress;
  status?: LiveChannelStatusEvent;
  message?: unknown;
  changed: number;
}

export class LivePanel extends PureComponent<Props, State> {
  private readonly isValid: boolean;
  subscription?: Unsubscribable;
  styles = getStyles(config.theme2);

  constructor(props: Props) {
    super(props);

    this.isValid = !!getGrafanaLiveSrv();
    this.state = { changed: 0 };
  }

  async componentDidMount() {
    this.loadChannel();
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options?.channel !== prevProps.options?.channel) {
      this.loadChannel();
    }
  }

  streamObserver: PartialObserver<LiveChannelEvent> = {
    next: (event: LiveChannelEvent) => {
      if (isLiveChannelStatusEvent(event)) {
        this.setState({ status: event, changed: Date.now() });
      } else if (isLiveChannelMessageEvent(event)) {
        this.setState({ message: event.message, changed: Date.now() });
      } else {
        console.log('ignore', event);
      }
    },
  };

  unsubscribe = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  };

  async loadChannel() {
    const addr = this.props.options?.channel;
    if (!isValidLiveChannelAddress(addr)) {
      console.log('INVALID', addr);
      this.unsubscribe();
      this.setState({
        addr: undefined,
      });
      return;
    }

    if (isEqual(addr, this.state.addr)) {
      console.log('Same channel', this.state.addr);
      return;
    }

    const live = getGrafanaLiveSrv();
    if (!live) {
      console.log('INVALID', addr);
      this.unsubscribe();
      this.setState({
        addr: undefined,
      });
      return;
    }
    this.unsubscribe();

    console.log('LOAD', addr);

    // Subscribe to new events
    try {
      this.subscription = live.getStream(addr).subscribe(this.streamObserver);
      this.setState({ addr, error: undefined });
    } catch (err) {
      this.setState({ addr: undefined, error: err });
    }
  }

  renderNotEnabled() {
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

  renderMessage(height: number) {
    const { options } = this.props;
    const { message } = this.state;

    if (!message) {
      return (
        <div>
          <h4>
            <Trans i18nKey="live.live-panel.waiting-for-data">Waiting for data:</Trans>
          </h4>
          {options.channel?.scope}/{options.channel?.namespace}/{options.channel?.path}
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
        } as PanelData;
        const props: PanelProps = {
          ...this.props,
          options: { frameIndex: 0, showHeader: true },
        };
        return <TablePanel {...props} data={data} height={height} />;
      }
    }

    return <pre>{JSON.stringify(message)}</pre>;
  }

  renderPublish(height: number) {
    const { options } = this.props;
    return (
      <LivePublish
        height={height}
        body={options.message}
        mode={options.publish ?? MessagePublishMode.JSON}
        onSave={(message) => this.props.onOptionsChange({ ...options, message })}
        addr={this.state.addr}
      />
    );
  }

  renderStatus() {
    const { status } = this.state;
    if (status?.state === LiveChannelConnectionState.Connected) {
      return; // nothing
    }

    let statusClass = '';
    if (status) {
      statusClass = this.styles.status[status.state];
    }
    return <div className={cx(statusClass, this.styles.statusWrap)}>{status?.state}</div>;
  }

  renderBody() {
    const { status } = this.state;
    const { options, height } = this.props;
    const publish = options.publish === MessagePublishMode.JSON || options.publish === MessagePublishMode.Influx;

    if (publish) {
      if (options.display === MessageDisplayMode.None) {
        return this.renderPublish(height);
      }

      // Both message and publish
      const halfHeight = height / 2;
      return (
        <div>
          <div style={{ height: halfHeight, overflow: 'hidden' }}>
            <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
              {this.renderMessage(halfHeight)}
            </CustomScrollbar>
          </div>
          <div>{this.renderPublish(halfHeight)}</div>
        </div>
      );
    }
    if (options.display === MessageDisplayMode.None) {
      return <pre>{JSON.stringify(status)}</pre>;
    }

    // Only message
    return (
      <div style={{ overflow: 'hidden', height }}>
        <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
          {this.renderMessage(height)}
        </CustomScrollbar>
      </div>
    );
  }

  render() {
    if (!this.isValid) {
      return this.renderNotEnabled();
    }
    const { addr, error } = this.state;
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
    return (
      <>
        {this.renderStatus()}
        {this.renderBody()}
      </>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
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
}));
