import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  Field,
  FieldSet,
  Input,
  LinkButton,
  LoadingPlaceholder,
  Select,
  Stack,
  Switch,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useCreateHookMutation, useGetHookQuery, useUpdateHookMutation } from '../api/pulseApi';
import { type HookType } from '../types';

// v1 ships a single transport. Kept as an array so adding Slack / Teams
// later is a one-line change and the Select already renders a dropdown.
const HOOK_TYPE_OPTIONS: Array<{ label: string; value: HookType }> = [{ label: 'Webhook', value: 'webhook' }];

interface FormState {
  name: string;
  type: HookType;
  url: string;
  secret: string;
  disabled: boolean;
}

const EMPTY_FORM: FormState = { name: '', type: 'webhook', url: '', secret: '', disabled: false };

/**
 * PulseHookEditPage creates a new hook (/admin/pulse/new) or edits an
 * existing one (/admin/pulse/edit/:uid). Secrets are write-only: the
 * API never returns the stored secret, only whether one exists, so on
 * edit the secret field starts blank with a "leave blank to keep"
 * affordance. Submitting blank on edit preserves the stored secret;
 * the form only sends `secret` when the user actually typed one.
 */
export default function PulseHookEditPage() {
  const { uid } = useParams<{ uid?: string }>();
  const isEdit = Boolean(uid);

  const { data: existing, isLoading: isLoadingExisting, isError: loadError } = useGetHookQuery(uid!, { skip: !uid });
  const [createHook, { isLoading: isCreating }] = useCreateHookMutation();
  const [updateHook, { isLoading: isUpdating }] = useUpdateHookMutation();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        type: existing.type,
        url: existing.url,
        secret: '',
        disabled: existing.disabled,
      });
    }
  }, [existing]);

  const nameInvalid = touched && form.name.trim().length === 0;
  const urlInvalid = touched && !isValidHttpUrl(form.url);
  const saving = isCreating || isUpdating;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (form.name.trim().length === 0 || !isValidHttpUrl(form.url)) {
      return;
    }
    try {
      if (isEdit && uid) {
        await updateHook({
          uid,
          req: {
            name: form.name.trim(),
            type: form.type,
            url: form.url.trim(),
            disabled: form.disabled,
            // Only send a secret when the user typed one: an empty
            // field on edit means "keep the stored secret" (the API
            // omits the field → backend leaves it untouched).
            ...(form.secret.length > 0 ? { secret: form.secret } : {}),
          },
        }).unwrap();
      } else {
        await createHook({
          name: form.name.trim(),
          type: form.type,
          url: form.url.trim(),
          disabled: form.disabled,
          ...(form.secret.length > 0 ? { secret: form.secret } : {}),
        }).unwrap();
      }
      locationService.push('/admin/pulse');
    } catch (err) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      setSubmitError(message || t('pulse.hooks.save-error', 'Could not save hook. Please try again.'));
    }
  }

  const pageNav = {
    text: isEdit
      ? t('pulse.hooks.edit-page-title', 'Edit Pulse hook')
      : t('pulse.hooks.new-page-title', 'New Pulse hook'),
  };

  return (
    <Page navId="pulse-hooks" pageNav={pageNav}>
      <Page.Contents>
        {isEdit && isLoadingExisting && <LoadingPlaceholder text={t('pulse.hooks.loading', 'Loading hooks…')} />}

        {isEdit && loadError && (
          <Alert title={t('pulse.hooks.not-found', 'Pulse hook not found')} severity="error">
            <Trans i18nKey="pulse.hooks.not-found-body">
              The hook you are trying to edit does not exist or has been deleted.
            </Trans>
          </Alert>
        )}

        {(!isEdit || (!isLoadingExisting && !loadError)) && (
          <form onSubmit={onSubmit}>
            <FieldSet label={t('pulse.hooks.fieldset', 'Hook settings')}>
              <Field
                label={t('pulse.hooks.field-name', 'Name')}
                description={t('pulse.hooks.field-name-desc', 'Unique name. Mentioned with @ in a Pulse thread.')}
                invalid={nameInvalid}
                error={t('pulse.hooks.field-name-error', 'Name is required')}
                required
              >
                <Input
                  id="pulse-hook-name"
                  value={form.name}
                  placeholder={t('pulse.hooks.field-name-placeholder', 'Grafana-P.S.')}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
                  maxLength={190}
                />
              </Field>

              <Field label={t('pulse.hooks.field-type', 'Type')}>
                <Select
                  inputId="pulse-hook-type"
                  options={HOOK_TYPE_OPTIONS}
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: (v.value as HookType) ?? 'webhook' }))}
                />
              </Field>

              <Field
                label={t('pulse.hooks.field-url', 'URL')}
                description={t('pulse.hooks.field-url-desc', 'The http(s) endpoint that receives the JSON payload.')}
                invalid={urlInvalid}
                error={t('pulse.hooks.field-url-error', 'Enter a valid http(s) URL')}
                required
              >
                <Input
                  id="pulse-hook-url"
                  value={form.url}
                  placeholder="https://example.com/pulse-hook"
                  onChange={(e) => setForm((f) => ({ ...f, url: e.currentTarget.value }))}
                />
              </Field>

              <Field
                label={t('pulse.hooks.field-secret', 'Signing secret')}
                description={
                  isEdit && existing?.hasSecret
                    ? t('pulse.hooks.field-secret-desc-existing', 'A secret is configured. Leave blank to keep it.')
                    : t(
                        'pulse.hooks.field-secret-desc',
                        'Optional. Used to HMAC-sign the payload so the receiver can verify it.'
                      )
                }
              >
                <Input
                  id="pulse-hook-secret"
                  type="password"
                  value={form.secret}
                  placeholder={
                    isEdit && existing?.hasSecret
                      ? t('pulse.hooks.field-secret-placeholder-existing', '••••••••')
                      : ''
                  }
                  onChange={(e) => setForm((f) => ({ ...f, secret: e.currentTarget.value }))}
                />
              </Field>

              <Field
                label={t('pulse.hooks.field-disabled', 'Disabled')}
                description={t(
                  'pulse.hooks.field-disabled-desc',
                  "When disabled, the hook won't fire and is hidden from the @-mention picker."
                )}
              >
                <Switch
                  id="pulse-hook-disabled"
                  value={form.disabled}
                  onChange={(e) => setForm((f) => ({ ...f, disabled: e.currentTarget.checked }))}
                />
              </Field>
            </FieldSet>

            {submitError && (
              <Alert title={t('pulse.hooks.save-error-title', 'Save failed')} severity="error">
                {submitError}
              </Alert>
            )}

            <Stack direction="row" gap={1}>
              <Button type="submit" disabled={saving || nameInvalid || urlInvalid}>
                {saving ? (
                  <Trans i18nKey="pulse.hooks.saving">Saving…</Trans>
                ) : (
                  <Trans i18nKey="pulse.hooks.save">Save</Trans>
                )}
              </Button>
              <LinkButton variant="secondary" href="/admin/pulse">
                <Trans i18nKey="pulse.hooks.cancel">Cancel</Trans>
              </LinkButton>
            </Stack>
          </form>
        )}
      </Page.Contents>
    </Page>
  );
}

/**
 * isValidHttpUrl mirrors the backend allowlist: only http(s) URLs are
 * acceptable hook targets. Uses the URL constructor rather than a regex
 * so we don't reimplement parsing (and to satisfy the frontend security
 * rule against treating URLs as strings).
 */
function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
