import { css } from '@emotion/css';
import { Controller, useForm } from 'react-hook-form';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import {
  Alert,
  Button,
  ClipboardButton,
  Divider,
  Field,
  LoadingBar,
  Select,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { t, Trans } from 'app/core/internationalization';

import { defaultZoom, getZoomOptions } from '../../../../extensions/reports/constants';
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

type ImageSettingsForm = {
  width: number;
  height: number;
  scaleFactor: number;
};

function SharePanelInternallyRenderer({ model }: SceneComponentProps<SharePanelInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading, imageUrl, panelRef, onDismiss } =
    model.useState();

  const { handleSubmit, register, control } = useForm<ImageSettingsForm>({
    mode: 'onBlur',
    defaultValues: {
      width: 100,
      height: 200,
      scaleFactor: defaultZoom,
    },
  });

  const [{ loading, value }, renderImage] = useAsyncFn(async () => {
    const response = await lastValueFrom(getBackendSrv().fetch<BlobPart>({ url: imageUrl, responseType: 'blob' }));
    const blob = new Blob([response.data], { type: 'image/png' });

    return URL.createObjectURL(blob);
  }, [model.state]);

  const panelTitle = panelRef?.resolve().state.title;

  const dashboard = getDashboardSceneFor(model);
  const isDashboardSaved = Boolean(dashboard.state.uid);

  const onRenderImageClick = async ({ width, height, scaleFactor }: ImageSettingsForm) => {
    await model.buildUrl({ width, height });
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
        <form onSubmit={handleSubmit(onRenderImageClick)}>
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
                    {...register('width', {
                      required: t('link.share-panel.render-image-width-required', 'Width is required'),
                    })}
                    type="number"
                    suffix="px"
                  />
                </Field>
                <Field label="Height" className={styles.imageConfigurationField}>
                  <Input
                    {...register('height', {
                      required: t('link.share-panel.render-image-height-required', 'Height is required'),
                    })}
                    type="number"
                    suffix="px"
                  />
                </Field>
                <Field label={'Zoom'} className={styles.imageConfigurationField}>
                  <Controller
                    name={'scaleFactor'}
                    control={control}
                    // defaultValue={defaultZoom}
                    render={({ field: { ref, value, onChange, ...field } }) => (
                      <Select<number>
                        {...field}
                        defaultValue={value}
                        onChange={(scale) => onChange(scale.value!)}
                        options={getZoomOptions().filter((opt) => !opt.isDisabled)}
                        // value={
                        //   getZoomOptions().find((option) => option.value === value && !option.isDisabled)
                        //     ? value
                        //     : defaultZoom
                        // }
                        // width={30}
                        placeholder={'xx%'}
                        aria-label={'Zoom'}
                      />
                    )}
                  />
                </Field>
              </Stack>
              <Stack gap={1}>
                <Button
                  icon="gf-layout-simple"
                  variant="secondary"
                  fill="solid"
                  type="submit"
                  disabled={!config.rendererAvailable || !isDashboardSaved}
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
        </form>
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
