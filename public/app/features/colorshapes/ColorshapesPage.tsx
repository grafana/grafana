import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { dateTime, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { Alert, type Column, InteractiveTable, LoadingPlaceholder, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

// Matches ListHitsV0alpha1BodyItems in
// apps/colorshapes/pkg/apis/colorshapes/v0alpha1/listhits_response_body_types_gen.go
interface Hit {
  createdAt: number;
  sourceIp: string;
  color: string;
  shape: string;
  createdBy: string;
}

interface Event {
  eventId: string;
  projectId: string;
  message: string;
  occurredAt: number;
}

const HITS_URL = '/apis/colorshapes.grafana.app/v0alpha1/namespaces/default/hits';
const EVENTS_URL = '/apis/colorshapes.grafana.app/v0alpha1/namespaces/default/events';

function defaultRange(): TimeRange {
  const now = dateTime();
  return {
    from: dateTime(now).subtract(1, 'hour'),
    to: now,
    raw: { from: 'now-1h', to: 'now' },
  };
}

function toTimeRange({ from, to }: { from: number; to: number }): TimeRange {
  return {
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: dateTime(from), to: dateTime(to) },
  };
}

export default function ColorshapesPage() {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsError, setEventsError] = useState<string>();

  const load = useCallback(async (r: TimeRange) => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await lastValueFrom(
        getBackendSrv().fetch<{ items: Hit[] }>({
          method: 'GET',
          url: HITS_URL,
          params: { from: r.from.valueOf(), to: r.to.valueOf() },
        })
      );
      setHits(response.data.items ?? []);
    } catch (err) {
      setError(
        isFetchError(err)
          ? (err.data?.error ?? err.statusText)
          : t('colorshapes.page.load-error', 'Failed to load hits')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const loadEvents = useCallback(async (r: TimeRange) => {
    setEventsError(undefined);
    try {
      const response = await lastValueFrom(
        getBackendSrv().fetch<{ items: Event[] }>({
          method: 'GET',
          url: EVENTS_URL,
          params: { from: r.from.valueOf(), to: r.to.valueOf() },
        })
      );
      setEvents(response.data.items ?? []);
    } catch (err) {
      setEventsError(isFetchError(err) ? (err.data?.error ?? err.statusText) : 'Failed to load errors');
    }
  }, []);

  useEffect(() => {
    loadEvents(range);
  }, [loadEvents, range]);

  const onMoveTimePicker = useCallback(
    (direction: number) => setRange((r) => toTimeRange(getShiftedTimeRange(direction, r))),
    []
  );
  const onZoom = useCallback(() => setRange((r) => toTimeRange(getZoomedTimeRange(r, 2))), []);

  const getRowId = useMemo(() => (row: Hit) => `${row.createdAt}-${row.createdBy}-${row.color}-${row.shape}`, []);
  const getEventRowId = useMemo(() => (row: Event) => row.eventId, []);

  const columns: Array<Column<Hit>> = useMemo(
    () => [
      {
        id: 'createdAt',
        header: t('colorshapes.page.column-created-at', 'Created at'),
        sortType: 'number',
        cell: ({ row: { original } }) => dateTime(original.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      },
      { id: 'createdBy', header: t('colorshapes.page.column-created-by', 'Created by') },
      { id: 'sourceIp', header: t('colorshapes.page.column-source-ip', 'Source IP') },
      { id: 'color', header: t('colorshapes.page.column-color', 'Color') },
      { id: 'shape', header: t('colorshapes.page.column-shape', 'Shape') },
    ],
    []
  );

  const eventColumns: Array<Column<Event>> = useMemo(
    () => [
      {
        id: 'occurredAt',
        header: 'Occurred at',
        sortType: 'number',
        cell: ({ row: { original } }) => dateTime(original.occurredAt).format('YYYY-MM-DD HH:mm:ss'),
      },
      { id: 'projectId', header: 'Project' },
      { id: 'eventId', header: 'Event ID' },
      { id: 'message', header: 'Error' },
    ],
    []
  );

  return (
    <Page navId="colorshapes" pageNav={{ text: t('colorshapes.page.title', 'Colorshapes') }}>
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <TimePickerWithHistory
            value={range}
            onChange={setRange}
            onChangeTimeZone={() => {}}
            onMoveBackward={() => onMoveTimePicker(-1)}
            onMoveForward={() => onMoveTimePicker(1)}
            onZoom={onZoom}
          />
          {error && (
            <Alert title={t('colorshapes.page.load-error', 'Failed to load hits')} severity="error">
              {error}
            </Alert>
          )}
          {eventsError && (
            <Alert title="Failed to load errors" severity="error">
              {eventsError}
            </Alert>
          )}
          {loading ? (
            <LoadingPlaceholder text={t('colorshapes.page.loading', 'Loading hits...')} />
          ) : (
            <>
              <h3>Error events</h3>
              <InteractiveTable columns={eventColumns} data={events} getRowId={getEventRowId} />
              <h3>Color hits</h3>
              <InteractiveTable columns={columns} data={hits} getRowId={getRowId} />
            </>
          )}
        </Stack>
      </Page.Contents>
    </Page>
  );
}
