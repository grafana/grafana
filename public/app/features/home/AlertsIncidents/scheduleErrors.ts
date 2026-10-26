import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';

export type ScheduleLoadError = 'not_available' | 'forbidden' | 'failed';

/** 404: IRM installed but no OnCall backend; 403: user lacks schedules:read in IRM; anything else is a plain failure. */
export function classifyScheduleError(error: unknown): ScheduleLoadError {
  if (isFetchError(error)) {
    if (error.status === 404) {
      return 'not_available';
    }
    if (error.status === 403) {
      return 'forbidden';
    }
  }
  return 'failed';
}

export function scheduleErrorTitle(error: ScheduleLoadError): string {
  switch (error) {
    case 'not_available':
      return t('home.on-call-card.error-not-available', 'Grafana IRM is not available');
    case 'forbidden':
      return t('home.on-call-card.error-forbidden', "You don't have access to IRM schedules");
    case 'failed':
      return t('home.on-call-card.error-failed', 'Could not load schedules');
  }
}
