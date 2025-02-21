import { css } from '@emotion/css';
import saveAs from 'file-saver';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, getBackendSrv, isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, FieldSet, Icon, Input, LoadingBar, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../../utils/interactions';

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

const selector = e2eSelectors.pages.ShareDashboardDrawer.ShareInternally.SharePanel;

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
    <div data-testid={selector.preview}>
      <Stack gap={2} direction="column">
        <Text element="h4">
          <Trans i18nKey="share-panel-image.preview.title">Panel preview</Trans>
        </Text>
        <form onSubmit={handleSubmit(onRenderImageClick)}>
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
                  data-testid={selector.widthInput}
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
                  data-testid={selector.heightInput}
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
                  data-testid={selector.scaleFactorInput}
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
                data-testid={selector.generateImageButton}
              >
                <Trans i18nKey="link.share-panel.render-image">Generate image</Trans>
              </Button>
              <Button
                onClick={onDownloadImageClick}
                icon={'download-alt'}
                variant="secondary"
                disabled={!image || loading || disabled}
                data-testid={selector.downloadImageButton}
              >
                <Trans i18nKey="link.share-panel.download-image">Download image</Trans>
              </Button>
            </Stack>
          </FieldSet>
        </form>
        {loading && (
          <div>
            <LoadingBar width={128} />
            <div className={styles.imageLoadingContainer}>
              <Text variant="body">{title || ''}</Text>
            </div>
          </div>
        )}
        {image && !loading && <img src={URL.createObjectURL(image)} alt="panel-preview-img" className={styles.image} />}
        {error && !loading && (
          <Alert severity="error" title={t('link.share-panel.render-image-error', 'Failed to render panel image')}>
            {isFetchError(error)
              ? error.statusText
              : t('link.share-panel.render-image-error-description', 'An error occurred when generating the image')}
          </Alert>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  imageConfigurationField: css({
    flex: 1,
  }),
  image: css({
    maxWidth: '100%',
    width: 'max-content',
  }),
  imageLoadingContainer: css({
    maxWidth: '100%',
    height: 362,
    border: `1px solid ${theme.components.input.borderColor}`,
    padding: theme.spacing(1),
  }),
});
