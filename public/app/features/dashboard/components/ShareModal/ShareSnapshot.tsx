import React, { PureComponent } from 'react';
import { Button, ClipboardButton, Icon, Spinner, Select, Input, LinkButton, Field } from '@grafana/ui';
import { AppEvents, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { appEvents } from 'app/core/core';
import { VariableRefresh } from '../../../variables/types';

const snapshotApiUrl = '/api/snapshots';

const expireOptions: Array<SelectableValue<number>> = [
  { label: 'Never', value: 0 },
  { label: '1 Hour', value: 60 * 60 },
  { label: '1 Day', value: 60 * 60 * 24 },
  { label: '7 Days', value: 60 * 60 * 24 * 7 },
];

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss(): void;
}

interface State {
  isLoading: boolean;
  step: number;
  snapshotName: string;
  selectedExpireOption: SelectableValue<number>;
  snapshotExpires?: number;
  snapshotUrl: string;
  deleteUrl: string;
  timeoutSeconds: number;
  externalEnabled: boolean;
  sharingButtonText: string;
}

export class ShareSnapshot extends PureComponent<Props, State> {
  private dashboard: DashboardModel;

  constructor(props: Props) {
    super(props);
    this.dashboard = props.dashboard;
    this.state = {
      isLoading: false,
      step: 1,
      selectedExpireOption: expireOptions[0],
      snapshotExpires: expireOptions[0].value,
      snapshotName: props.dashboard.title,
      timeoutSeconds: 4,
      snapshotUrl: '',
      deleteUrl: '',
      externalEnabled: false,
      sharingButtonText: '',
    };
  }

  componentDidMount() {
    this.getSnaphotShareOptions();
  }

  async getSnaphotShareOptions() {
    const shareOptions = await getBackendSrv().get('/api/snapshot/shared-options');
    this.setState({
      sharingButtonText: shareOptions['externalSnapshotName'],
      externalEnabled: shareOptions['externalEnabled'],
    });
  }

  createSnapshot = (external?: boolean) => () => {
    const { timeoutSeconds } = this.state;
    this.dashboard.snapshot = {
      timestamp: new Date(),
    };

    if (!external) {
      this.dashboard.snapshot.originalUrl = window.location.href;
    }

    this.setState({ isLoading: true });
    this.dashboard.startRefresh();

    setTimeout(() => {
      this.saveSnapshot(this.dashboard, external);
    }, timeoutSeconds * 1000);
  };

  saveSnapshot = async (dashboard: DashboardModel, external?: boolean) => {
    const { snapshotExpires } = this.state;
    const dash = this.dashboard.getSaveModelClone();
    this.scrubDashboard(dash);

    const cmdData = {
      dashboard: dash,
      name: dash.title,
      expires: snapshotExpires,
      external: external,
    };

    try {
      const results: { deleteUrl: any; url: any } = await getBackendSrv().post(snapshotApiUrl, cmdData);
      this.setState({
        deleteUrl: results.deleteUrl,
        snapshotUrl: results.url,
        step: 2,
      });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  scrubDashboard = (dash: DashboardModel) => {
    const { panel } = this.props;
    const { snapshotName } = this.state;
    // change title
    dash.title = snapshotName;

    // make relative times absolute
    dash.time = getTimeSrv().timeRange();

    // remove panel queries & links
    dash.panels.forEach((panel) => {
      panel.targets = [];
      panel.links = [];
      panel.datasource = null;
    });

    // remove annotation queries
    const annotations = dash.annotations.list.filter((annotation) => annotation.enable);
    dash.annotations.list = annotations.map((annotation: any) => {
      return {
        name: annotation.name,
        enable: annotation.enable,
        iconColor: annotation.iconColor,
        snapshotData: annotation.snapshotData,
        type: annotation.type,
        builtIn: annotation.builtIn,
        hide: annotation.hide,
      };
    });

    // remove template queries
    dash.getVariables().forEach((variable: any) => {
      variable.query = '';
      variable.options = variable.current ? [variable.current] : [];
      variable.refresh = VariableRefresh.never;
    });

    // snapshot single panel
    if (panel) {
      const singlePanel = panel.getSaveModel();
      singlePanel.gridPos.w = 24;
      singlePanel.gridPos.x = 0;
      singlePanel.gridPos.y = 0;
      singlePanel.gridPos.h = 20;
      dash.panels = [singlePanel];
    }

    // cleanup snapshotData
    delete this.dashboard.snapshot;
    this.dashboard.forEachPanel((panel: PanelModel) => {
      delete panel.snapshotData;
    });
    this.dashboard.annotations.list.forEach((annotation) => {
      delete annotation.snapshotData;
    });
  };

  deleteSnapshot = async () => {
    const { deleteUrl } = this.state;
    await getBackendSrv().get(deleteUrl);
    this.setState({ step: 3 });
  };

  getSnapshotUrl = () => {
    return this.state.snapshotUrl;
  };

  onSnapshotNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ snapshotName: event.target.value });
  };

  onTimeoutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ timeoutSeconds: Number(event.target.value) });
  };

  onExpireChange = (option: SelectableValue<number>) => {
    this.setState({
      selectedExpireOption: option,
      snapshotExpires: option.value,
    });
  };

  onSnapshotUrlCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  renderStep1() {
    const { onDismiss } = this.props;
    const {
      snapshotName,
      selectedExpireOption,
      timeoutSeconds,
      isLoading,
      sharingButtonText,
      externalEnabled,
    } = this.state;

    return (
      <>
        <div>
          <p className="share-modal-info-text">
            A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive
            data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data
            and series names embedded in your dashboard.
          </p>
          <p className="share-modal-info-text">
            Keep in mind, your snapshot <em>can be viewed by anyone</em> that has the link and can access the URL. Share
            wisely.
          </p>
        </div>
        <Field label="Snapshot name">
          <Input width={30} value={snapshotName} onChange={this.onSnapshotNameChange} />
        </Field>
        <Field label="Expire">
          <Select width={30} options={expireOptions} value={selectedExpireOption} onChange={this.onExpireChange} />
        </Field>
        <Field
          label="Timeout (seconds)"
          description="You might need to configure the timeout value if it takes a long time to collect your dashboard
            metrics."
        >
          <Input type="number" width={21} value={timeoutSeconds} onChange={this.onTimeoutChange} />
        </Field>

        <div className="gf-form-button-row">
          <Button variant="primary" disabled={isLoading} onClick={this.createSnapshot()}>
            Local Snapshot
          </Button>
          {externalEnabled && (
            <Button variant="secondary" disabled={isLoading} onClick={this.createSnapshot(true)}>
              {sharingButtonText}
            </Button>
          )}
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </div>
      </>
    );
  }

  renderStep2() {
    const { snapshotUrl } = this.state;

    return (
      <>
        <div className="gf-form" style={{ marginTop: '40px' }}>
          <div className="gf-form-row">
            <a href={snapshotUrl} className="large share-modal-link" target="_blank" rel="noreferrer">
              <Icon name="external-link-alt" /> {snapshotUrl}
            </a>
            <br />
            <ClipboardButton variant="secondary" getText={this.getSnapshotUrl} onClipboardCopy={this.onSnapshotUrlCopy}>
              Copy Link
            </ClipboardButton>
          </div>
        </div>

        <div className="pull-right" style={{ padding: '5px' }}>
          Did you make a mistake?{' '}
          <LinkButton variant="link" target="_blank" onClick={this.deleteSnapshot}>
            Delete snapshot.
          </LinkButton>
        </div>
      </>
    );
  }

  renderStep3() {
    return (
      <div className="share-modal-header">
        <p className="share-modal-info-text">
          The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before
          before it is removed from browser caches or CDN caches.
        </p>
      </div>
    );
  }

  render() {
    const { isLoading, step } = this.state;

    return (
      <>
        {step === 1 && this.renderStep1()}
        {step === 2 && this.renderStep2()}
        {step === 3 && this.renderStep3()}
        {isLoading && <Spinner inline={true} />}
      </>
    );
  }
}
