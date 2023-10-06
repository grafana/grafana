import React from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Button, Field, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DashboardScene } from '../scene/DashboardScene';

import { SceneShareTabState } from './types';
import { transformSceneToSaveModel, trimDashboardForSnapshot } from '../serialization/transformSceneToSaveModel';

const SNAPSHOTS_API_ENDPOINT = '/api/snapshots';
const DEFAULT_EXPIRE_OPTION: SelectableValue<number> = {
  label: t('share-modal.snapshot.expire-never', `Never`),
  value: 0,
};

const DEFAULT_TIMEOUT = 4;

const EXPIRE_OPTIONS = [
  DEFAULT_EXPIRE_OPTION,
  {
    label: t('share-modal.snapshot.expire-hour', `1 Hour`),
    value: 60 * 60,
  },
  {
    label: t('share-modal.snapshot.expire-day', `1 Day`),
    value: 60 * 60 * 24,
  },
  {
    label: t('share-modal.snapshot.expire-week', `7 Days`),
    value: 60 * 60 * 24 * 7,
  },
];

type SnapshotSharingOptions = {
  externalEnabled: boolean;
  externalSnapshotName: string;
  externalSnapshotURL: string;
  snapshotEnabled: boolean;
};
export interface ShareSnapshotTabState extends SceneShareTabState {
  panelRef?: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
  snapshotName?: string;
  selectedExpireOption?: SelectableValue<number>;
  timeout?: number;

  snapshotSharingOptions?: SnapshotSharingOptions;
}

export class ShareSnapshotTab extends SceneObjectBase<ShareSnapshotTabState> {
  static Component = ShareSnapshoTabRenderer;

  public constructor(state: ShareSnapshotTabState) {
    super({
      ...state,
      snapshotName: state.dashboardRef.resolve().state.title,
      selectedExpireOption: DEFAULT_EXPIRE_OPTION,
      timeout: DEFAULT_TIMEOUT,
    });

    this.addActivationHandler(() => {
      this._onActivate();
    });
  }

  private _onActivate() {
    getBackendSrv()
      .get('/api/snapshot/shared-options')
      .then((shareOptions: SnapshotSharingOptions) => {
        if (this.isActive) {
          this.setState({
            snapshotSharingOptions: shareOptions,
          });
        }
      });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.snapshot', 'Snapshot');
  }

  public onSnasphotNameChange = (snapshotName: string) => {
    this.setState({ snapshotName: snapshotName.trim() });
  };

  public onExpireChange = (option: number) => {
    this.setState({
      selectedExpireOption: EXPIRE_OPTIONS.find((o) => o.value === option),
    });
  };

  public onTimeoutChange = (timeout: number) => {
    this.setState({ timeout });
  };

  public onLocalSnapshotCreate = async () => {
    const timeRange = sceneGraph.getTimeRange(this);
    const { dashboardRef, selectedExpireOption } = this.state;
    const saveModel = transformSceneToSaveModel(dashboardRef.resolve(), true);

    const snapshot = trimDashboardForSnapshot(this.state.snapshotName || '', timeRange.state.value, saveModel);

    const cmdData = {
      dashboard: snapshot,
      name: snapshot.title,
      expires: selectedExpireOption?.value,
      external: false,
    };

    try {
      const results: { deleteUrl: string; url: string } = await getBackendSrv().post(SNAPSHOTS_API_ENDPOINT, cmdData);
      console.log(results);
      console.log(results.url);
      // this.setState({
      //   deleteUrl: results.deleteUrl,
      //   snapshotUrl: results.url,
      //   step: 2,
      // });
    } finally {
      // trackDashboardSharingActionPerType(external ? 'publish_snapshot' : 'local_snapshot', shareDashboardType.snapshot);
      // this.setState({ isLoading: false });
    }
  };

  public onExternalSnapshotCreate = () => {};
}

function ShareSnapshoTabRenderer({ model }: SceneComponentProps<ShareSnapshotTab>) {
  const { snapshotName, selectedExpireOption, timeout, modalRef, snapshotSharingOptions } = model.useState();

  // const [s, fn] = useAsyncFn(async () => {
  //   model.onLocalSnapshotCreate();
  // });
  return (
    <>
      <div>
        <p className="share-modal-info-text">
          <Trans i18nKey="share-modal.snapshot.info-text-1">
            A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive
            data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data
            and series names embedded in your dashboard.
          </Trans>
        </p>
        <p className="share-modal-info-text">
          <Trans i18nKey="share-modal.snapshot.info-text-2">
            Keep in mind, your snapshot <em>can be viewed by anyone</em> that has the link and can access the URL. Share
            wisely.
          </Trans>
        </p>
      </div>

      <Field label={t('share-modal.snapshot.name', `Snapshot name`)}>
        <Input
          id="snapshot-name-input"
          width={30}
          defaultValue={snapshotName}
          onBlur={(e) => model.onSnasphotNameChange(e.target.value)}
        />
      </Field>

      <Field label={t('share-modal.snapshot.expire', `Expire`)}>
        <RadioButtonGroup<number>
          id="expire-select-input"
          options={EXPIRE_OPTIONS}
          value={selectedExpireOption?.value}
          onChange={model.onExpireChange}
        />
      </Field>

      <Field
        label={t('share-modal.snapshot.timeout', `Timeout (seconds)`)}
        description={t(
          'share-modal.snapshot.timeout-description',
          `You might need to configure the timeout value if it takes a long time to collect your dashboard metrics.`
        )}
      >
        <Input
          id="timeout-input"
          type="number"
          width={21}
          value={timeout}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => model.onTimeoutChange(Number(e.target.value))}
        />
      </Field>

      <Modal.ButtonRow>
        <Button
          variant="secondary"
          onClick={() => {
            modalRef?.resolve().onDismiss();
          }}
          fill="outline"
        >
          <Trans i18nKey="share-modal.snapshot.cancel-button">Cancel</Trans>
        </Button>

        {snapshotSharingOptions?.externalEnabled && (
          <Button variant="secondary" /*disabled={isLoading}*/ onClick={model.onExternalSnapshotCreate}>
            {snapshotSharingOptions?.externalSnapshotName}
          </Button>
        )}
        <Button variant="primary" /*disabled={isLoading}*/ onClick={model.onLocalSnapshotCreate}>
          <Trans i18nKey="share-modal.snapshot.local-button">Local Snapshot</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
}
