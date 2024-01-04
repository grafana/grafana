import React from 'react';

import { SelectableValue, UrlQueryMap } from '@grafana/data';
import {
  SceneComponentProps,
  SceneGridItem,
  SceneObjectBase,
  SceneObjectRef,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Alert, Button, Field, FieldSet, Input, RadioButtonGroup, Spinner, Switch } from '@grafana/ui';
import config from 'app/core/config';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { t, Trans } from 'app/core/internationalization';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../scene/DashboardScene';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getDashboardUrl } from '../utils/urlBuilders';
import { getPanelIdForVizPanel, getRenderTimeZone } from '../utils/utils';

import { SceneShareTabState } from './types';

const THEME_CURRENT = 'current';

const imageFormats: Array<SelectableValue<string>> = [
  {
    label: 'PNG',
    value: 'png',
  },
  {
    label: 'JPG',
    value: 'jpg',
  },
  {
    label: 'BMP',
    value: 'bmp',
  },
];

export interface ShareImageTabState extends SceneShareTabState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
}

interface ShareOptions {
  useAbsoluteTimeRange: boolean;
  selectedTheme: string;
  selectedFormat: string;
  width: number;
  height: number;
  isDownloading: boolean;
  usePanelSize: boolean;
  error: string | null;
}

const ERROR_MSG = "Couldn't render image";

export class ShareImageTab extends SceneObjectBase<ShareImageTabState> {
  public tabId = shareDashboardType.image;

  static Component = ShareImageTabRenderer;

  constructor(state: Omit<ShareImageTabState, keyof ShareOptions>) {
    super({
      ...state,
      useAbsoluteTimeRange: true,
      selectedTheme: THEME_CURRENT,
      selectedFormat: imageFormats[0].value!,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      isDownloading: false,
      usePanelSize: false,
      error: null,
    });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.image', 'Image');
  }

  buildUrl = () => {
    const { panelRef, dashboardRef, useAbsoluteTimeRange, selectedTheme, width, height, usePanelSize } = this.state;
    const dashboard = dashboardRef.resolve();
    const panel = panelRef?.resolve();
    const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
    const urlParamsUpdate: UrlQueryMap = {};

    if (panel) {
      urlParamsUpdate.panelId = getPanelIdForVizPanel(panel);
    }

    urlParamsUpdate.width = width;
    urlParamsUpdate.height = height;

    if (usePanelSize && panel && panel.parent instanceof SceneGridItem) {
      const width = panel?.parent?.state.width;
      const height = panel?.parent?.state.height;
      const colWidth = (window.innerWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;

      if (width && height) {
        urlParamsUpdate.width = Math.floor(colWidth * width);
        urlParamsUpdate.height = Math.floor(GRID_CELL_HEIGHT * height);
      }
    }

    if (useAbsoluteTimeRange) {
      urlParamsUpdate.from = timeRange.state.value.from.toISOString();
      urlParamsUpdate.to = timeRange.state.value.to.toISOString();
    }

    if (selectedTheme !== THEME_CURRENT) {
      urlParamsUpdate.theme = selectedTheme!;
    }

    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: location.search,
      updateQuery: urlParamsUpdate,
      absolute: true,

      soloRoute: true,
      render: true,
      timeZone: getRenderTimeZone(timeRange.getTimeZone()),
    });

    return imageUrl;
  };

  onUseAbsoluteTimeRangeChange = () => {
    this.setState({ useAbsoluteTimeRange: !this.state.useAbsoluteTimeRange });
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value });
  };

  onWidthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ width: Number(event.target.value) });
  };

  onHeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ height: Number(event.target.value) });
  };

  onFormatChange = (value: string) => {
    this.setState({ selectedFormat: value });
  };

  onPanelSizeFlagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ usePanelSize: event.currentTarget.checked });
  };

  onDownload = () => {
    const panel = this.state.panelRef?.resolve();
    if (!panel) {
      return;
    }

    const imageUrl = this.buildUrl();

    this.setState({ isDownloading: true, error: null });
    fetch(imageUrl)
      .then((response) => {
        if (!response.ok) {
          this.setState({ isDownloading: false, error: ERROR_MSG });
          throw new Error(ERROR_MSG);
        }
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = panel.state.title + '.' + this.state.selectedFormat;
        link.click();

        this.setState({ isDownloading: false, error: null });
      })
      .catch((error) => {
        this.setState({ isDownloading: false, error: error.message });
      });
  };
}

function ShareImageTabRenderer({ model }: SceneComponentProps<ShareImageTab>) {
  const state = model.useState();
  const { panelRef, dashboardRef } = state;
  const dashboard = dashboardRef.resolve();
  const panel = panelRef?.resolve();
  const isRelativeTime = dashboard ? dashboard.state.$timeRange?.state.to === 'now' : false;
  const { useAbsoluteTimeRange, selectedTheme, selectedFormat, width, height, isDownloading, usePanelSize, error } =
    state;
  const isDashboardSaved = Boolean(dashboard.state.uid);

  const panelSizeTranslation = t(
    'share-modal.image.use-panel-size-description',
    `Use the same width and height as the panel`
  );

  const timeRangeDescriptionTranslation = t(
    'share-modal.link.time-range-description',
    `Transforms the current relative time range to an absolute time range`
  );

  return (
    <>
      {panel && config.rendererAvailable && (
        <>
          <p className="share-modal-info-text">
            <Trans i18nKey="share-modal.image.info-text">Download a snapshot of the panel as an image.</Trans>
          </p>
          <FieldSet>
            <Field
              label={t('share-modal.link.time-range-label', `Lock time range`)}
              description={isRelativeTime ? timeRangeDescriptionTranslation : ''}
            >
              <Switch
                id="share-absolute-time-range"
                value={useAbsoluteTimeRange}
                onChange={model.onUseAbsoluteTimeRangeChange}
              />
            </Field>
            <ThemePicker selectedTheme={selectedTheme} onChange={model.onThemeChange} />
            <Field label={t('share-modal.image.format', `Image format`)}>
              <RadioButtonGroup options={imageFormats} value={selectedFormat} onChange={model.onFormatChange} />
            </Field>
            <FieldSet>
              <Field label={t('share-modal.image.use-panel-size', 'Use panel size')} description={panelSizeTranslation}>
                <Switch id="image-panel-size" value={usePanelSize} onChange={model.onPanelSizeFlagChange} />
              </Field>
              {!usePanelSize && (
                <>
                  <Field label={t('share-modal.image.width', `Image width`)}>
                    <Input
                      id="image-width-input"
                      data-testid="image-width-input"
                      type="number"
                      width={15}
                      value={width}
                      onChange={model.onWidthChange}
                    />
                  </Field>
                  <Field label={t('share-modal.image.height', `Image height`)}>
                    <Input
                      id="image-height-input"
                      data-testid="image-height-input"
                      width={15}
                      value={height}
                      onChange={model.onHeightChange}
                    />
                  </Field>
                </>
              )}
            </FieldSet>

            {isDashboardSaved && (
              <div style={{ marginBottom: '10px' }}>
                <Button
                  fullWidth={true}
                  aria-label="Download image"
                  variant="primary"
                  onClick={model.onDownload}
                  type="button"
                  disabled={isDownloading}
                >
                  {t('share-modal.image.download-button-label', `Download image`)}
                  {isDownloading && <Spinner inline={true} style={{ marginLeft: '10px' }} />}
                </Button>
              </div>
            )}

            {error && (
              <Alert severity="error" title={t('share-modal.image.error', 'Error')} bottomSpacing={0}>
                {error}
              </Alert>
            )}

            {!isDashboardSaved && (
              <Alert
                severity="info"
                title={t('share-modal.link.save-alert', 'Dashboard is not saved')}
                bottomSpacing={0}
              >
                <Trans i18nKey="share-modal.link.save-dashboard">
                  To render a panel image, you must save the dashboard first.
                </Trans>
              </Alert>
            )}
          </FieldSet>
        </>
      )}

      {panel && !config.rendererAvailable && (
        <Alert
          severity="info"
          title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
          bottomSpacing={0}
        >
          <Trans i18nKey="share-modal.link.render-instructions">
            To render a panel image, you must install the
            <a
              href="https://grafana.com/grafana/plugins/grafana-image-renderer"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Grafana image renderer plugin
            </a>
            . Please contact your Grafana administrator to install the plugin.
          </Trans>
        </Alert>
      )}
    </>
  );
}
