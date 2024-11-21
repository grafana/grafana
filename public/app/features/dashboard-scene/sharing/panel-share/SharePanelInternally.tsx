import { css } from '@emotion/css';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert, Button, ClipboardButton, Divider, Field, LoadingBar, Stack, Text, useStyles2 } from '@grafana/ui';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { t, Trans } from 'app/core/internationalization';

import { getDashboardSceneFor } from '../../utils/utils';
import ShareInternallyConfiguration from '../ShareInternallyConfiguration';
import { ShareLinkTab, ShareLinkTabState } from '../ShareLinkTab';

export class SharePanelInternally extends ShareLinkTab {
  static Component = SharePanelInternallyRenderer;

  constructor(state: Partial<ShareLinkTabState>) {
    super(state);
  }

  public getTabLabel() {
    return t('share-panel.drawer.share-link-title', 'Link settings');
  }
}

// type ImageSettingsForm = {
//   width: number;
//   height: number;
//   zoom: number;
// };

function SharePanelInternallyRenderer({ model }: SceneComponentProps<SharePanelInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading, imageUrl, panelRef, onDismiss } =
    model.useState();

  // const [renderImage, { data: image, isLoading, isFetching }] = useLazyRenderImageQuery();

  const [{ loading, value }, renderImage] = useAsyncFn(async () => {
    const response = await lastValueFrom(getBackendSrv().fetch<BlobPart>({ url: imageUrl, responseType: 'blob' }));
    const blob = new Blob([response.data], { type: 'image/png' });

    return URL.createObjectURL(blob);
  }, [imageUrl]);

  const panelTitle = panelRef?.resolve().state.title;
  // const { handleSubmit, reset, ...formMethods } = useForm({ mode: 'onBlur', defaultValues: settings });

  const dashboard = getDashboardSceneFor(model);
  const isDashboardSaved = Boolean(dashboard.state.uid);

  const onRenderImageClick = async () => {
    await model.buildUrl();
    await renderImage();
  };

  return (
    <div>
      <Text variant="body">
        <Trans i18nKey="link.share-panel.config-description">
          Create a personalized, direct link to share your panel within your organization, with the following
          customization settings:
        </Trans>
      </Text>
      <div className={styles.configurationContainer}>
        <ShareInternallyConfiguration
          useLockedTime={useLockedTime}
          onToggleLockedTime={() => model.onToggleLockedTime()}
          useShortUrl={useShortUrl}
          onUrlShorten={() => model.onUrlShorten()}
          selectedTheme={selectedTheme}
          onChangeTheme={(t) => model.onThemeChange(t)}
          isLoading={isBuildUrlLoading}
        />
        <ClipboardButton
          icon="link"
          variant="primary"
          fill="outline"
          disabled={isBuildUrlLoading}
          getText={model.getShareUrl}
          onClipboardCopy={model.onCopy}
        >
          <Trans i18nKey="link.share.copy-link-button">Copy link</Trans>
        </ClipboardButton>
      </div>
      <Divider spacing={2} />
      <Stack gap={2} direction="column">
        {!isDashboardSaved && (
          <Alert severity="info" title={t('share-modal.link.save-alert', 'Dashboard is not saved')} bottomSpacing={0}>
            <Trans i18nKey="share-modal.link.save-dashboard">
              To render a panel image, you must save the dashboard first.
            </Trans>
          </Alert>
        )}
        {!config.rendererAvailable && (
          <Alert
            severity="info"
            title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
            bottomSpacing={0}
          >
            <Trans i18nKey="share-modal.link.render-instructions">
              To render a panel image, you must install the{' '}
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
        <Stack gap={2} direction="column">
          <Text element="h4">
            <Trans i18nKey="link.share-panel.render-image-title">Panel preview</Trans>
          </Text>
          <Text element="h5">
            <Trans i18nKey="link.share-panel.render-image-subtitle">Image settings</Trans>
          </Text>
          <div>
            <Stack gap={1} justifyContent="space-between" direction={{ xs: 'column', sm: 'row' }}>
              <Field label="Width" className={styles.imageConfigurationField}>
                <Input
                  type="number"
                  suffix="px"
                  // onChange={(event) => onChange(event.currentTarget.value, to.value)}
                  // addonAfter={icon}
                  // onKeyDown={submitOnEnter}
                  // data-testid={selectors.components.TimePicker.fromField}
                  // value={from.value}
                />
              </Field>
              <Field label="Height" className={styles.imageConfigurationField}>
                <Input
                  type="number"
                  suffix="px"
                  // onChange={(event) => onChange(event.currentTarget.value, to.value)}
                  // addonAfter={icon}
                  // onKeyDown={submitOnEnter}
                  // data-testid={selectors.components.TimePicker.fromField}
                  // value={from.value}
                />
              </Field>
              <Field label="Zoom" className={styles.imageConfigurationField}>
                <Input name="importantInput" required />
              </Field>
            </Stack>
            <Stack gap={1}>
              <Button
                icon="gf-layout-simple"
                variant="secondary"
                fill="solid"
                disabled={!config.rendererAvailable || !isDashboardSaved}
                onClick={onRenderImageClick}
              >
                <Trans i18nKey="link.share-panel.render-image">Render image</Trans>
              </Button>
              <Button variant="secondary" fill="outline" onClick={onDismiss}>
                <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
              </Button>
            </Stack>
          </div>
          {loading && (
            <div>
              <LoadingBar width={128} />
              <div className={styles.imageLoadingContainer}>
                <Text variant="body">{panelTitle || ''}</Text>
              </div>
            </div>
          )}
          {value && !loading && <img src={value} alt="panel-img" className={styles.image} />}
        </Stack>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configDescription: css({
    marginBottom: theme.spacing(2),
  }),
  configurationContainer: css({
    marginTop: theme.spacing(2),
  }),
  imageConfigurationField: css({
    flex: 1,
  }),
  image: css({
    maxWidth: 724,
    width: '100%',
  }),
  imageLoadingContainer: css({
    maxWidth: 724,
    height: 362,
    border: `1px solid ${theme.components.input.borderColor}`,
    padding: theme.spacing(1),
  }),
});
