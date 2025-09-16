import { PureComponent } from 'react';
import * as React from 'react';

import { isEmptyObject, SelectableValue, VariableRefresh } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Button, ClipboardButton, Field, Input, LinkButton, Modal, Select, Spinner, Stack } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { getDashboardSnapshotSrv } from '../../services/SnapshotSrv';

import { ShareModalTabProps } from './types';
import { getTrackingSource } from './utils';

interface Props extends ShareModalTabProps {}

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
  private expireOptions: Array<SelectableValue<number>>;

  constructor(props: Props) {
    super(props);
    this.dashboard = props.dashboard;
    this.expireOptions = [
      {
        label: t('share-modal.snapshot.expire-hour', `1 Hour`),
        value: 60 * 60,
      },
      {
        label: t('share-modal.snapshot.expire-day', `1 Day`),
        value: 60 * 60 * 24,
      },
      {
        label: t('share-modal.snapshot.expire-week', `1 Week`),
        value: 60 * 60 * 24 * 7,
      },
      {
        label: t('share-modal.snapshot.expire-never', `Never`),
        value: 0,
      },
    ];
    this.state = {
      isLoading: false,
      step: 1,
      selectedExpireOption: this.expireOptions[2],
      snapshotExpires: this.expireOptions[2].value,
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
    const shareOptions = await getDashboardSnapshotSrv().getSharingOptions();
    this.setState({
      sharingButtonText: shareOptions.externalSnapshotName,
      externalEnabled: shareOptions.externalEnabled,
    });
  }

  createSnapshot = (external?: boolean) => () => {
    const { timeoutSeconds } = this.state;
    this.dashboard.snapshot = {
      timestamp: new Date(),
    };

    this.setState({ isLoading: true });
    this.dashboard.startRefresh();

    setTimeout(() => {
      this.saveSnapshot(this.dashboard, external);
    }, timeoutSeconds * 1000);
  };

  saveSnapshot = async (dashboard: DashboardModel, external?: boolean) => {
    const { snapshotExpires, timeoutSeconds } = this.state;
    const dash = this.dashboard.getSaveModelCloneOld();

    this.scrubDashboard(dash);

    const cmdData = {
      dashboard: dash,
      name: dash.title,
      expires: snapshotExpires,
      external: external,
    };

    try {
      const results = await getDashboardSnapshotSrv().create(cmdData);
      this.setState({
        deleteUrl: results.deleteUrl,
        snapshotUrl: results.url,
        step: 2,
      });
    } finally {
      if (external) {
        DashboardInteractions.publishSnapshotClicked({
          expires: snapshotExpires,
          timeout: timeoutSeconds,
          shareResource: getTrackingSource(this.props.panel),
        });
      } else {
        DashboardInteractions.publishSnapshotLocalClicked({
          expires: snapshotExpires,
          timeout: timeoutSeconds,
          shareResource: getTrackingSource(this.props.panel),
        });
      }
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

    // Remove links
    dash.links = [];

    // remove panel queries & links
    dash.panels.forEach((panel) => {
      panel.targets = [];
      panel.links = [];
      panel.datasource = null;
    });

    // remove annotation queries
    const annotations = dash.annotations.list.filter((annotation) => annotation.enable);

    dash.annotations.list = annotations.map((annotation) => {
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
    dash.getVariables().forEach((variable) => {
      if ('query' in variable) {
        variable.query = '';
      }
      if ('options' in variable) {
        variable.options = variable.current && !isEmptyObject(variable.current) ? [variable.current] : [];
      }
      if ('refresh' in variable) {
        variable.refresh = VariableRefresh.never;
      }
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

  renderStep1() {
    const { onDismiss } = this.props;
    const { snapshotName, selectedExpireOption, timeoutSeconds, isLoading, sharingButtonText, externalEnabled } =
      this.state;

    const snapshotNameTranslation = t('share-modal.snapshot.name', `Snapshot name`);
    const expireTranslation = t('share-modal.snapshot.expire', `Expire`);
    const timeoutTranslation = t('share-modal.snapshot.timeout', `Timeout (seconds)`);
    const timeoutDescriptionTranslation = t(
      'share-modal.snapshot.timeout-description',
      `You might need to configure the timeout value if it takes a long time to collect your dashboard metrics.`
    );

    return (
      <>
        <div>
          <p>
            <Trans i18nKey="share-modal.snapshot.info-text-1">
              A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive
              data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data
              and series names embedded in your dashboard.
            </Trans>
          </p>
          <p>
            <Trans i18nKey="share-modal.snapshot.info-text-2">
              Keep in mind, your snapshot <em>can be viewed by anyone</em> that has the link and can access the URL.
              Share wisely.
            </Trans>
          </p>
        </div>
        <Field label={snapshotNameTranslation}>
          <Input id="snapshot-name-input" width={30} value={snapshotName} onChange={this.onSnapshotNameChange} />
        </Field>
        <Field label={expireTranslation}>
          <Select
            inputId="expire-select-input"
            width={30}
            options={this.expireOptions}
            value={selectedExpireOption}
            onChange={this.onExpireChange}
          />
        </Field>
        <Field label={timeoutTranslation} description={timeoutDescriptionTranslation}>
          <Input id="timeout-input" type="number" width={21} value={timeoutSeconds} onChange={this.onTimeoutChange} />
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="share-modal.snapshot.cancel-button">Cancel</Trans>
          </Button>
          {externalEnabled && (
            <Button variant="secondary" disabled={isLoading} onClick={this.createSnapshot(true)}>
              {sharingButtonText}
            </Button>
          )}
          <Button variant="primary" disabled={isLoading} onClick={this.createSnapshot()}>
            <Trans i18nKey="share-modal.snapshot.local-button">Publish Snapshot</Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    );
  }

  renderStep2() {
    const { snapshotUrl } = this.state;

    return (
      <Stack direction="column" gap={0}>
        <Field label={t('share-modal.snapshot.url-label', 'Snapshot URL')}>
          <Input
            id="snapshot-url-input"
            value={snapshotUrl}
            readOnly
            addonAfter={
              <ClipboardButton icon="copy" variant="primary" getText={this.getSnapshotUrl}>
                <Trans i18nKey="share-modal.snapshot.copy-link-button">Copy</Trans>
              </ClipboardButton>
            }
          />
        </Field>

        <div style={{ alignSelf: 'flex-end', padding: '5px' }}>
          <Trans i18nKey="share-modal.snapshot.mistake-message">Did you make a mistake? </Trans>&nbsp;
          <LinkButton fill="text" target="_blank" onClick={this.deleteSnapshot}>
            <Trans i18nKey="share-modal.snapshot.delete-button">Delete snapshot.</Trans>
          </LinkButton>
        </div>
      </Stack>
    );
  }

  renderStep3() {
    return (
      <p>
        <Trans i18nKey="share-modal.snapshot.deleted-message">
          The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before
          before it is removed from browser caches or CDN caches.
        </Trans>
      </p>
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
