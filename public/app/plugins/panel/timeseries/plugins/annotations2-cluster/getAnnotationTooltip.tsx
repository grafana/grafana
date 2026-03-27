import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import alertDef from 'app/features/alerting/state/alertDef';

import { AnnotationVals } from './types';

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
  onAnnotationDelete?: (id: number) => void
) {
  const annoId = annoVals.id?.[annoIdx];
  const dashboardUID = annoVals.dashboardUID?.[annoIdx] ?? undefined;
  const timeEnd = annoVals.timeEnd?.[annoIdx];
  const isRegion = annoVals.isRegion?.[annoIdx] && timeEnd != null;

  // grafana can be configured to load alert rules from loki. Those annotations cannot be edited or deleted. The id being 0 is the best indicator the annotation came from loki
  const canUpdateAnno = dashboardUID !== undefined && annoId != null && annoId > 0;
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
    onDelete: annoId != null && onAnnotationDelete ? () => onAnnotationDelete(annoId) : undefined,
    canEdit,
    canDelete,
    time,
    text,
    alertText,
    alertState,
    avatarImgSrc,
  };
}
