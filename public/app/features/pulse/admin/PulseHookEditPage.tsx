import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  ControlledCollapse,
  Field,
  FieldSet,
  Input,
  LinkButton,
  LoadingPlaceholder,
  Select,
  Stack,
  Switch,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useCreateHookMutation, useGetHookQuery, useUpdateHookMutation } from '../api/pulseApi';
import { type HookType } from '../types';
import { pulseErrorMessage } from '../utils/errors';

const HOOK_TYPE_OPTIONS: Array<{ label: string; value: HookType }> = [
  { label: 'Webhook', value: 'webhook' },
  { label: 'Remote MCP', value: 'mcp' },
  { label: 'Remote Agent', value: 'agent' },
];

interface FormState {
  name: string;
  type: HookType;
  url: string;
  secret: string;
  disabled: boolean;
}

const EMPTY_FORM: FormState = { name: '', type: 'webhook', url: '', secret: '', disabled: false };

// Reference material shown inline because the feature is experimental and
// has no published docs yet. Kept as module consts (not JSX literals) so
// the code samples render verbatim and aren't treated as translatable copy.
const HEADERS_REFERENCE = `POST <your-url>
Content-Type: application/json
User-Agent: Grafana-Pulse-Hooks/1.0
X-Grafana-Pulse-Event: thread_created | pulse_added
X-Grafana-Pulse-Hook-Uid: <hook uid>
X-Grafana-Pulse-Signature: sha256=<hmac-sha256 of body>   # only when a signing secret is set`;

// Mirrors pkg/services/pulse WebhookPayload (version v1alpha1). Kept in
// sync by hand; the regression risk is low since the shape is stable.
const EXAMPLE_PAYLOAD = JSON.stringify(
  {
    version: 'v1alpha1',
    event: 'pulse_added',
    triggeredAt: '2026-06-24T20:55:00Z',
    orgId: 1,
    hook: { uid: 'aBc123', name: 'my-custom-pulse-hook', type: 'webhook' },
    resource: {
      kind: 'dashboard',
      uid: 'adv96sn',
      panelId: 2,
      url: 'https://grafana.example.com/d/adv96sn?pulse=thread-eflh20mfwvw1se',
    },
    thread: { uid: 'eflh20mfwvw1se', title: 'Latency looks off' },
    pulse: {
      uid: 'pls_7f3a',
      parentUid: 'eflh20mfwvw1se',
      authorUserId: 1,
      authorKind: 'user',
      bodyText: '@my-custom-pulse-hook can you take a look?',
      body: { root: { type: 'root', children: [] } },
      created: '2026-06-24T20:55:00Z',
    },
  },
  null,
  2
);

/**
 * PulseHookEditPage creates a new hook (/admin/pulse/new) or edits an
 * existing one (/admin/pulse/edit/:uid). Secrets are write-only: the
 * API never returns the stored secret, only whether one exists, so on
 * edit the secret field starts blank with a "leave blank to keep"
 * affordance. Submitting blank on edit preserves the stored secret;
 * the form only sends `secret` when the user actually typed one.
 */
export default function PulseHookEditPage() {
  const styles = useStyles2(getStyles);
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
  const isMCP = form.type === 'mcp';
  const isAgent = form.type === 'agent';
  const urlDescription = isMCP
    ? t('pulse.hooks.field-url-desc-mcp', 'The allowlisted remote MCP http(s) endpoint.')
    : isAgent
      ? t('pulse.hooks.field-url-desc-agent', 'The allowlisted remote agent http(s) endpoint.')
      : t('pulse.hooks.field-url-desc', 'The http(s) endpoint that receives the JSON payload.');
  const urlPlaceholder = isMCP
    ? t('pulse.hooks.field-url-placeholder-mcp', 'https://example.com/mcp')
    : isAgent
      ? t('pulse.hooks.field-url-placeholder-agent', 'https://example.com/pulse/chat')
      : t('pulse.hooks.field-url-placeholder', 'https://example.com/pulse-hook');
  const secretLabel = isMCP
    ? t('pulse.hooks.field-secret-mcp', 'Bearer token')
    : isAgent
      ? t('pulse.hooks.field-secret-agent', 'Bearer token')
      : t('pulse.hooks.field-secret', 'Signing secret');
  const secretDescription =
    isMCP && isEdit && existing?.hasSecret
      ? t('pulse.hooks.field-secret-desc-existing-mcp', 'A bearer token is configured. Leave blank to keep it.')
      : isMCP
        ? t('pulse.hooks.field-secret-desc-mcp', 'Required for Remote MCP dispatch.')
        : isAgent && isEdit && existing?.hasSecret
          ? t('pulse.hooks.field-secret-desc-existing-agent', 'A bearer token is configured. Leave blank to keep it.')
          : isAgent
            ? t('pulse.hooks.field-secret-desc-agent', 'Required for Remote Agent dispatch.')
            : isEdit && existing?.hasSecret
              ? t('pulse.hooks.field-secret-desc-existing', 'A secret is configured. Leave blank to keep it.')
              : t(
                  'pulse.hooks.field-secret-desc',
                  'Optional. Used to HMAC-sign the payload so the receiver can verify it.'
                );

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
      setSubmitError(pulseErrorMessage(err) || t('pulse.hooks.save-error', 'Could not save hook. Please try again.'));
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
              <Stack direction="column" gap={2}>
                <Field
                  noMargin
                  label={t('pulse.hooks.field-name', 'Name')}
                  description={t('pulse.hooks.field-name-desc', 'Unique name. Mentioned with @ in a Pulse thread.')}
                  invalid={nameInvalid}
                  error={t('pulse.hooks.field-name-error', 'Name is required')}
                  required
                >
                  <Input
                    id="pulse-hook-name"
                    value={form.name}
                    placeholder={t('pulse.hooks.field-name-placeholder', 'my-custom-pulse-hook')}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, name: value }));
                    }}
                    maxLength={190}
                  />
                </Field>

                <Field noMargin label={t('pulse.hooks.field-type', 'Type')}>
                  <Select
                    inputId="pulse-hook-type"
                    options={HOOK_TYPE_OPTIONS}
                    value={form.type}
                    onChange={(v) => {
                      const type = v?.value ?? 'webhook';
                      setForm((f) => ({ ...f, type }));
                    }}
                  />
                </Field>

                <Field
                  noMargin
                  label={t('pulse.hooks.field-url', 'URL')}
                  description={urlDescription}
                  invalid={urlInvalid}
                  error={t('pulse.hooks.field-url-error', 'Enter a valid http(s) URL')}
                  required
                >
                  <Input
                    id="pulse-hook-url"
                    value={form.url}
                    placeholder={urlPlaceholder}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, url: value }));
                    }}
                  />
                </Field>

                <Field noMargin label={secretLabel} description={secretDescription}>
                  <Input
                    id="pulse-hook-secret"
                    type="password"
                    value={form.secret}
                    placeholder={
                      isEdit && existing?.hasSecret
                        ? t('pulse.hooks.field-secret-placeholder-existing', '••••••••')
                        : ''
                    }
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, secret: value }));
                    }}
                  />
                </Field>

                <Field
                  noMargin
                  label={t('pulse.hooks.field-disabled', 'Disabled')}
                  description={t(
                    'pulse.hooks.field-disabled-desc',
                    "When disabled, the hook won't fire and is hidden from the @-mention picker."
                  )}
                >
                  <Switch
                    id="pulse-hook-disabled"
                    value={form.disabled}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setForm((f) => ({ ...f, disabled: checked }));
                    }}
                  />
                </Field>
              </Stack>
            </FieldSet>

            <ControlledCollapse
              isOpen={!isEdit}
              label={t('pulse.hooks.payload-collapse-label', 'What this hook delivers (experimental)')}
            >
              <Stack direction="column" gap={2}>
                <Text element="p" color="secondary">
                  <Trans i18nKey="pulse.hooks.payload-intro">
                    After a pulse is saved, Grafana sends an HTTP POST to the URL above for every hook mentioned in that
                    pulse. This happens when a new thread is created or a reply is added. Delivery is fire-and-forget, so
                    a slow or failing endpoint never blocks the pulse from being saved, and the response is ignored.
                  </Trans>
                </Text>
                <Text element="p" color="secondary">
                  <Trans i18nKey="pulse.hooks.payload-signature">
                    When a signing secret is set, the request body is signed with HMAC-SHA256 and the signature is sent
                    in the X-Grafana-Pulse-Signature header so your receiver can verify the request really came from
                    Grafana.
                  </Trans>
                </Text>
                <Text element="p" color="secondary" weight="medium">
                  <Trans i18nKey="pulse.hooks.payload-headers-label">Request headers</Trans>
                </Text>
                <pre className={styles.code}>{HEADERS_REFERENCE}</pre>
                <Text element="p" color="secondary" weight="medium">
                  <Trans i18nKey="pulse.hooks.payload-body-label">Example request body</Trans>
                </Text>
                <pre className={styles.code}>{EXAMPLE_PAYLOAD}</pre>
              </Stack>
            </ControlledCollapse>

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

const getStyles = (theme: GrafanaTheme2) => ({
  code: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1),
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowX: 'auto',
  }),
});
