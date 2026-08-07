import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import alertDef from 'app/features/alerting/state/alertDef';

import { type AnnotationVals } from './types';

const timeFormatter = (value: number, timeZone: string) =>
  dateTimeFormat(value, {
    format: systemDateFormats.fullDate,
    timeZone,
  });

export function getAnnotationTooltip(
  annoVals: AnnotationVals,
  annoIdx: number,
  timeZone: string,
  canEditAnnotations: (dsUID: string) => boolean,
  canDeleteAnnotations: (dsUID: string) => boolean,
  onAnnotationDelete?: (id: string) => void
) {
  const annoId = annoVals.id?.[annoIdx];
  const dashboardUID = annoVals.dashboardUID?.[annoIdx] ?? undefined;
  const timeEnd = annoVals.timeEnd?.[annoIdx];
  const isRegion = annoVals.isRegion?.[annoIdx] && timeEnd != null;

  // Grafana can be configured to load alert rules from Loki; those annotations cannot be
  // edited or deleted, and a falsy id (0 from the legacy API, or absent) is the best
  // signal. k8s annotations carry non-numeric string ids; so falsy - not `> 0`
  // This matches the `if (!annotation.id)` guard in the annotation API client.
  const canUpdateAnno = dashboardUID !== undefined && Boolean(annoId);
  const canEdit = canUpdateAnno && canEditAnnotations(dashboardUID);
  const canDelete = canUpdateAnno && canDeleteAnnotations(dashboardUID) && onAnnotationDelete != null;

  let time: string = timeFormatter(annoVals.time[annoIdx], timeZone);
  const text: string = annoVals.text?.[annoIdx] ?? '';

  if (isRegion) {
    time += ' - ' + timeFormatter(timeEnd, timeZone);
  }

  // Alerting specific
  const alertId = annoVals.alertId?.[annoIdx];
  const alertText = annoVals.data?.[annoIdx] ? alertDef.getAlertAnnotationText(annoVals.data[annoIdx]) : '';
  const newState = annoVals.newState?.[annoIdx];
  const alertState = alertId !== undefined && newState ? newState : undefined;

  const title = !alertText ? annoVals.title?.[annoIdx] : undefined;
  const avatarImgSrc =
    annoVals.login?.[annoIdx] && annoVals.avatarUrl?.[annoIdx] ? annoVals.avatarUrl?.[annoIdx] : undefined;

  return {
    title,
    onDelete: annoId && onAnnotationDelete ? () => onAnnotationDelete(String(annoId)) : undefined,
    canEdit,
    canDelete,
    time,
    text,
    alertText,
    alertState,
    avatarImgSrc,
  };
}
