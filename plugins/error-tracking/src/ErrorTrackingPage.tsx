import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, isFetchError, PluginPage } from '@grafana/runtime';
import { Alert, Button, Field, Input, InteractiveTable, LoadingPlaceholder, Stack, type Column } from '@grafana/ui';

interface Event {
  occurredAt: number;
  project: string;
  message: string;
  createdBy: string;
}

// The API server authenticates the signed Grafana identity and checks that this
// route namespace matches it before deriving the storage tenant. The browser
// only uses Grafana's runtime namespace for URL selection.
const EVENTS_API_PATH = '/apis/error-tracking.grafana.app/v0alpha1/namespaces';

function eventsURL() {
  return `${EVENTS_API_PATH}/${encodeURIComponent(config.namespace)}/events`;
}

export default function ErrorTrackingPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [project, setProject] = useState('error-tracking');
  const [message, setMessage] = useState('sample error');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await getBackendSrv().get<{ items: Event[] }>(eventsURL());
      setEvents(response.items ?? []);
    } catch (err) {
      setError(
        isFetchError(err)
          ? (err.data?.error ?? err.statusText)
          : t('errortracking.page.load-error', 'Failed to load events')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!project.trim() || !message.trim()) {
      setError(t('errortracking.page.required', 'Project and message are required'));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await getBackendSrv().post(eventsURL(), { project: project.trim(), message: message.trim() });
      await load();
    } catch (err) {
      setError(
        isFetchError(err)
          ? (err.data?.error ?? err.statusText)
          : t('errortracking.page.save-error', 'Failed to save event')
      );
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<Column<Event>> = useMemo(
    () => [
      {
        id: 'occurredAt',
        header: t('errortracking.page.column-occurred-at', 'Occurred at'),
        cell: ({ row: { original } }) => dateTime(original.occurredAt).format('YYYY-MM-DD HH:mm:ss'),
      },
      { id: 'project', header: t('errortracking.page.column-project', 'Project') },
      { id: 'message', header: t('errortracking.page.column-message', 'Message') },
      { id: 'createdBy', header: t('errortracking.page.column-created-by', 'Created by') },
    ],
    []
  );

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <p>
          {t(
            'errortracking.page.description',
            'Write and read a sample event through the Error tracking API and PostgreSQL.'
          )}
        </p>
        <form onSubmit={submit}>
          <Stack alignItems="end" gap={2}>
            <Field label={t('errortracking.page.project', 'Project')} noMargin>
              <Input value={project} onChange={(event) => setProject(event.currentTarget.value)} />
            </Field>
            <Field label={t('errortracking.page.message', 'Message')} noMargin>
              <Input value={message} onChange={(event) => setMessage(event.currentTarget.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t('errortracking.page.saving', 'Saving...') : t('errortracking.page.record', 'Record event')}
            </Button>
          </Stack>
        </form>
        {error && (
          <Alert title={t('errortracking.page.request-failed', 'Request failed')} severity="error">
            {error}
          </Alert>
        )}
        {loading ? (
          <LoadingPlaceholder text={t('errortracking.page.loading', 'Loading events...')} />
        ) : (
          <InteractiveTable
            columns={columns}
            data={events}
            getRowId={(event) => `${event.occurredAt}-${event.project}-${event.message}`}
          />
        )}
      </Stack>
    </PluginPage>
  );
}
