import { memo, useEffect, useState } from 'react';

import { isEmptyObject, type SelectableValue, VariableRefresh } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Button, ClipboardButton, Field, Input, LinkButton, Modal, Select, Spinner, Stack } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { getDashboardSnapshotSrv } from '../../services/SnapshotSrv';

import { type ShareModalTabProps } from './types';
import { getTrackingSource } from './utils';

interface Props extends ShareModalTabProps {}

const selectors = e2eSelectors.pages.ShareDashboardModal.SnapshotScene;

const getExpireOptions = (): Array<SelectableValue<number>> => [
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

export const ShareSnapshot = memo(({ dashboard, panel, onDismiss }: Props) => {
  const expireOptions = getExpireOptions();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedExpireOption, setSelectedExpireOption] = useState(expireOptions[2]);
  const [snapshotName, setSnapshotName] = useState(dashboard.title);
  const [timeoutSeconds, setTimeoutSeconds] = useState(4);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [deleteUrl, setDeleteUrl] = useState('');
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [sharingButtonText, setSharingButtonText] = useState('');
  const snapshotExpires = selectedExpireOption.value;

  useEffect(() => {
    getDashboardSnapshotSrv()
      .getSharingOptions()
      .then((shareOptions) => {
        setSharingButtonText(shareOptions.externalSnapshotName);
        setExternalEnabled(shareOptions.externalEnabled);
      });
  }, []);

  const scrubDashboard = (dash: DashboardModel) => {
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
    delete dashboard.snapshot;
    dashboard.forEachPanel((panel: PanelModel) => {
      delete panel.snapshotData;
    });
    dashboard.annotations.list.forEach((annotation) => {
      delete annotation.snapshotData;
    });
  };

  const saveSnapshot = async (external?: boolean) => {
    const dash = dashboard.getSaveModelCloneOld();

    scrubDashboard(dash);

    const cmdData = {
      dashboard: dash,
      name: dash.title,
      expires: snapshotExpires,
      external: external,
    };

    try {
      const results = await getDashboardSnapshotSrv().create(cmdData);
      setDeleteUrl(results.deleteUrl);
      setSnapshotUrl(results.url);
      setStep(2);
    } finally {
      if (external) {
        DashboardInteractions.publishSnapshotClicked({
          expires: snapshotExpires,
          timeout: timeoutSeconds,
          shareResource: getTrackingSource(panel),
        });
      } else {
        DashboardInteractions.publishSnapshotLocalClicked({
          expires: snapshotExpires,
          timeout: timeoutSeconds,
          shareResource: getTrackingSource(panel),
        });
      }
      setIsLoading(false);
    }
  };

  const createSnapshot = (external?: boolean) => () => {
    dashboard.snapshot = {
      timestamp: new Date(),
    };

    setIsLoading(true);
    dashboard.startRefresh();

    setTimeout(() => {
      saveSnapshot(external);
    }, timeoutSeconds * 1000);
  };

  const deleteSnapshot = async () => {
    await getBackendSrv().get(deleteUrl);
    setStep(3);
  };

  const renderStep1 = () => {
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
          <Input
            id="snapshot-name-input"
            width={30}
            value={snapshotName}
            onChange={(event) => setSnapshotName(event.currentTarget.value)}
          />
        </Field>
        <Field label={expireTranslation}>
          <Select
            inputId="expire-select-input"
            width={30}
            options={expireOptions}
            value={selectedExpireOption}
            onChange={setSelectedExpireOption}
          />
        </Field>
        <Field label={timeoutTranslation} description={timeoutDescriptionTranslation}>
          <Input
            id="timeout-input"
            type="number"
            width={21}
            value={timeoutSeconds}
            onChange={(event) => setTimeoutSeconds(Number(event.currentTarget.value))}
          />
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="share-modal.snapshot.cancel-button">Cancel</Trans>
          </Button>
          {externalEnabled && (
            <Button variant="secondary" disabled={isLoading} onClick={createSnapshot(true)}>
              {sharingButtonText}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={isLoading}
            onClick={createSnapshot()}
            data-testid={selectors.PublishSnapshot}
          >
            <Trans i18nKey="share-modal.snapshot.local-button">Publish Snapshot</Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    );
  };

  const renderStep2 = () => (
    <Stack direction="column" gap={0}>
      <Field label={t('share-modal.snapshot.url-label', 'Snapshot URL')}>
        <Input
          id="snapshot-url-input"
          value={snapshotUrl}
          data-testid={selectors.CopyUrlInput}
          readOnly
          addonAfter={
            <ClipboardButton
              icon="copy"
              variant="primary"
              getText={() => snapshotUrl}
              data-testid={selectors.CopyUrlButton}
            >
              <Trans i18nKey="share-modal.snapshot.copy-link-button">Copy</Trans>
            </ClipboardButton>
          }
        />
      </Field>

      <div style={{ alignSelf: 'flex-end', padding: '5px' }}>
        <Trans i18nKey="share-modal.snapshot.mistake-message">Did you make a mistake? </Trans>&nbsp;
        <LinkButton fill="text" target="_blank" onClick={deleteSnapshot}>
          <Trans i18nKey="share-modal.snapshot.delete-button">Delete snapshot.</Trans>
        </LinkButton>
      </div>
    </Stack>
  );

  const renderStep3 = () => (
    <p>
      <Trans i18nKey="share-modal.snapshot.deleted-message">
        The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before
        before it is removed from browser caches or CDN caches.
      </Trans>
    </p>
  );

  return (
    <>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {isLoading && <Spinner inline={true} />}
    </>
  );
});

ShareSnapshot.displayName = 'ShareSnapshot';
