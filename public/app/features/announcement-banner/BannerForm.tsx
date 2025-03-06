import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppEvents, dateTime } from '@grafana/data';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Button, CodeEditor, DateTimePicker, Field, FieldSet, Select, Stack, Switch } from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { t, Trans } from 'app/core/internationalization';

import { BannerPreview } from './BannerPreview';
import { Spec } from './api';
import { useCreateOrUpdateBanner } from './hooks';
import { AnnouncementBannerFormData } from './types';

function getDefaultValues(banner?: Spec): AnnouncementBannerFormData {
  if (!banner) {
    return { enabled: false, message: '', variant: 'info', visibility: 'authenticated', startTime: dateTime() };
  }
  return {
    ...banner,
    startTime: banner.startTime ? dateTime(banner.startTime) : dateTime(),
    endTime: banner.endTime ? dateTime(banner.endTime) : undefined,
  };
}

export interface Props {
  banner?: Spec;
  name?: string;
}
export function BannerForm({ banner, name }: Props) {
  const [submitData, request] = useCreateOrUpdateBanner(name);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
    getValues,
  } = useForm<AnnouncementBannerFormData>({
    defaultValues: getDefaultValues(banner),
  });
  const [watchStartTime, watchMessage, watchVariant] = watch(['startTime', 'message', 'variant']);
  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      const formData = getValues();

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('banner.api.result.saved', 'Banner settings saved')],
      });
      reset({
        ...formData,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
      });
    }
  }, [request.isSuccess, reset, getValues]);

  const onSubmit = async (data: AnnouncementBannerFormData) => {
    reportInteraction('grafana_banner_saved', {
      enabled: data.enabled,
      endSelected: !!data.endTime,
      daysShown: !!data.endTime ? data.startTime && dateTime(data.endTime).diff(data.startTime, 'days') : undefined,
      visibility: data.visibility,
      variant: data.variant,
    });
    const bannerSpec = {
      ...data,
      startTime: data.startTime ? data.startTime.toISOString() : undefined,
      endTime: data.endTime ? data.endTime.toISOString() : undefined,
    };
    submitData(bannerSpec);
  };

  return (
    <Stack direction={'column'} gap={2}>
      <BannerPreview message={watchMessage} variant={watchVariant} />
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 650 }}>
        <FieldSet label={t('banner.form.title', 'Configure banner')}>
          <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
          <Field label={t('banner.form.enabled.label', 'Enabled')}>
            {/*Switch label is necessary for tests to work*/}
            <Switch {...register('enabled')} label={t('banner.form.enabled.switch-label', 'Enabled')} />
          </Field>
          <Field
            label={t('banner.form.message.label', 'Message')}
            description={
              <Trans i18nKey="banner.form.message.description">Text content of the banner. Supports markdown.</Trans>
            }
          >
            <Controller
              name={'message'}
              control={control}
              render={({ field: { ref, ...field } }) => {
                return <CodeEditor {...field} height={200} language={'markdown'} />;
              }}
            />
          </Field>
          <Field
            label={t('banner.form.start.label', 'Starts at')}
            description={
              <Trans i18nKey="banner.form.start.description">
                The banner will be shown starting from this date/time.
              </Trans>
            }
          >
            <Controller
              name={'startTime'}
              control={control}
              render={({ field: { ref, value, ...field } }) => (
                <DateTimePicker
                  {...field}
                  date={value || undefined}
                  showSeconds={false}
                  clearable
                  minDate={new Date()}
                />
              )}
            />
          </Field>
          <Field
            label={t('banner.form.end.label', 'Ends at')}
            invalid={!!errors?.endTime}
            error={errors?.endTime?.message}
            description={
              <Trans i18nKey="banner.form.end.description">
                If no end date is selected, the banner is displayed indefinitely.
              </Trans>
            }
          >
            <Controller
              name={'endTime'}
              control={control}
              rules={{
                validate: (value) => {
                  if (!watchStartTime || !value) {
                    return true;
                  }
                  return value > watchStartTime
                    ? true
                    : t('banner.form.end.error', 'End time must be after start time');
                },
              }}
              render={({ field: { ref, value, ...field } }) => (
                <DateTimePicker {...field} date={value || undefined} showSeconds={false} clearable />
              )}
            />
          </Field>
          {/*TODO: Restore this after backend support for anonymous API access is added*/}
          {/*<Field label={t('banner.form.visibility.label', 'Visibility')}>*/}
          {/*  <Controller*/}
          {/*    control={control}*/}
          {/*    name="visibility"*/}
          {/*    render={({ field: { ref, ...field } }) => (*/}
          {/*      <RadioButtonGroup*/}
          {/*        {...field}*/}
          {/*        options={[*/}
          {/*          { label: t('banner.form.options.everyone', 'Everyone'), value: 'everyone' },*/}
          {/*          { label: t('banner.form.options.authenticated', 'Authenticated users'), value: 'authenticated' },*/}
          {/*        ]}*/}
          {/*      />*/}
          {/*    )}*/}
          {/*  />*/}
          {/*</Field>*/}
          <Stack>
            <Field label={t('banner.form.variant.label', 'Variant')}>
              <Controller
                name={'variant'}
                control={control}
                render={({ field: { ref, onChange, ...field } }) => (
                  <Select
                    {...field}
                    onChange={(variant) => {
                      onChange(variant.value);
                    }}
                    placeholder={t('banner.form.variant.placeholder', 'Select banner type')}
                    options={[
                      { label: t('banner.form.options.info', 'Info'), value: 'info' },
                      { label: t('banner.form.options.warning', 'Warning'), value: 'warning' },
                      { label: t('banner.form.options.error', 'Error'), value: 'error' },
                    ]}
                  />
                )}
              />
            </Field>
          </Stack>
          <Button type="submit" disabled={!isDirty || request.isLoading}>
            {request.isLoading ? (
              <Trans i18nKey="banner.form.button-saving">Saving...</Trans>
            ) : (
              <Trans i18nKey="banner.form.button-save">Save</Trans>
            )}
          </Button>
        </FieldSet>
      </form>
    </Stack>
  );
}
