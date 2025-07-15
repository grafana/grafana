import { css } from '@emotion/css';
import saveAs from 'file-saver';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Icon, Input, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import { ImagePreview } from '../components/ImagePreview';

type ImageSettingsForm = {
  width: number;
  height: number;
  scaleFactor: number;
};

type Props = {
  title: string;
  buildUrl: (urlParams: UrlQueryMap) => void;
  imageUrl: string;
  disabled: boolean;
  theme: string;
};

export function SharePanelPreview({ title, imageUrl, buildUrl, disabled, theme }: Props) {
  const styles = useStyles2(getStyles);

  const {
    handleSubmit,
    register,
    watch,
    formState: { errors, isValid },
  } = useForm<ImageSettingsForm>({
    mode: 'onChange',
    defaultValues: {
      width: 1000,
      height: 500,
      scaleFactor: 1,
    },
  });

  useEffect(() => {
    buildUrl({ width: watch('width'), height: watch('height'), scale: watch('scaleFactor') });
  }, [buildUrl, watch]);

  const [{ loading, value: image, error }, renderImage] = useAsyncFn(async (imageUrl) => {
    const response = await lastValueFrom(getBackendSrv().fetch<BlobPart>({ url: imageUrl, responseType: 'blob' }));
    return new Blob([response.data], { type: 'image/png' });
  }, []);

  const onRenderImageClick = async (data: ImageSettingsForm) => {
    const { width, height, scaleFactor } = data;
    DashboardInteractions.generatePanelImageClicked({
      width,
      height,
      scaleFactor,
      theme,
      shareResource: 'panel',
    });

    await renderImage(imageUrl);
  };

  const onDownloadImageClick = () => {
    DashboardInteractions.downloadPanelImageClicked({ shareResource: 'panel' });
    saveAs(image!, `${title}.png`);
  };

  const onChange = () => {
    buildUrl({ width: watch('width'), height: watch('height'), scale: watch('scaleFactor') });
  };

  return (
    <section aria-labelledby="panel-preview-heading">
      <Stack gap={2} direction="column">
        <Text element="h4" id="panel-preview-heading">
          <Trans i18nKey="share-panel-image.preview.title">Panel preview</Trans>
        </Text>
        <form
          onSubmit={handleSubmit(onRenderImageClick)}
          aria-label={t('share-panel-image.form.label', 'Panel image settings')}
        >
          <FieldSet
            disabled={!config.rendererAvailable}
            label={
              <Stack gap={1} alignItems="center">
                <Text element="h5">
                  <Trans i18nKey="share-panel-image.settings.title">Image settings</Trans>
                </Text>
                <Tooltip
                  content={t(
                    'share-panel-image.settings.max-warning',
                    'Setting maximums are limited by the image renderer service'
                  )}
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            }
          >
            <Stack gap={1} justifyContent="space-between" direction={{ xs: 'column', sm: 'row' }}>
              <Field
                label={t('share-panel-image.settings.width-label', 'Width')}
                className={styles.imageConfigurationField}
                required
                invalid={!!errors.width}
                error={errors.width?.message}
              >
                <Input
                  {...register('width', {
                    required: t('share-panel-image.settings.width-required', 'Width is required'),
                    min: {
                      value: 1,
                      message: t('share-panel-image.settings.width-min', 'Width must be equal or greater than 1'),
                    },
                    valueAsNumber: true,
                    onChange: onChange,
                  })}
                  placeholder={t('share-panel-image.settings.width-placeholder', '1000')}
                  type="number"
                  suffix="px"
                  aria-label={t('share-panel-image.settings.width-label', 'Width')}
                />
              </Field>
              <Field
                label={t('share-panel-image.settings.height-label', 'Height')}
                className={styles.imageConfigurationField}
                required
                invalid={!!errors.height}
                error={errors.height?.message}
              >
                <Input
                  {...register('height', {
                    required: t('share-panel-image.settings.height-required', 'Height is required'),
                    min: {
                      value: 1,
                      message: t('share-panel-image.settings.height-min', 'Height must be equal or greater than 1'),
                    },
                    valueAsNumber: true,
                    onChange: onChange,
                  })}
                  placeholder={t('share-panel-image.settings.height-placeholder', '500')}
                  type="number"
                  suffix="px"
                  aria-label={t('share-panel-image.settings.height-label', 'Height')}
                />
              </Field>
              <Field
                label={t('share-panel-image.settings.scale-factor-label', 'Scale factor')}
                className={styles.imageConfigurationField}
                required
                invalid={!!errors.scaleFactor}
                error={errors.scaleFactor?.message}
              >
                <Input
                  {...register('scaleFactor', {
                    required: t('share-panel-image.settings.scale-factor-required', 'Scale factor is required'),
                    min: {
                      value: 1,
                      message: t(
                        'share-panel-image.settings.scale-factor-min',
                        'Scale factor must be equal or greater than 1'
                      ),
                    },
                    valueAsNumber: true,
                    onChange: onChange,
                  })}
                  placeholder={t('share-panel-image.settings.scale-factor-placeholder', '1')}
                  type="number"
                  aria-label={t('share-panel-image.settings.scale-factor-label', 'Scale factor')}
                />
              </Field>
            </Stack>
            <Stack gap={1} direction={{ xs: 'column', sm: 'row' }}>
              <Button
                icon="gf-layout-simple"
                variant="secondary"
                fill="solid"
                type="submit"
                disabled={disabled || loading || !isValid}
                aria-describedby={disabled ? 'generate-button-disabled-help' : undefined}
              >
                <Trans i18nKey="link.share-panel.render-image">Generate image</Trans>
              </Button>
              <Button
                onClick={onDownloadImageClick}
                icon={'download-alt'}
                variant="secondary"
                disabled={!image || loading || disabled}
                aria-describedby={!image && !loading ? 'download-button-disabled-help' : undefined}
              >
                <Trans i18nKey="link.share-panel.download-image">Download image</Trans>
              </Button>
            </Stack>
            {disabled && (
              <Text variant="bodySmall" color="secondary" id="generate-button-disabled-help">
                <Trans i18nKey="share-panel-image.disabled-help">Save the dashboard to enable image generation</Trans>
              </Text>
            )}
            {!image && !loading && (
              <Text variant="bodySmall" color="secondary" id="download-button-disabled-help">
                <Trans i18nKey="share-panel-image.download-disabled-help">
                  Generate an image first to enable download
                </Trans>
              </Text>
            )}
          </FieldSet>
        </form>

        <ImagePreview
          imageBlob={image || null}
          isLoading={loading}
          error={
            error
              ? { title: t('share-panel-image.error-title', 'Failed to generate image'), message: error.message }
              : null
          }
          title={title}
        />
      </Stack>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  imageConfigurationField: css({
    flex: 1,
  }),
});
