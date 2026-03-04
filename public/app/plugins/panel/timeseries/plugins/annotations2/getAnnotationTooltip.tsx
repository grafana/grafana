import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import alertDef from 'app/features/alerting/state/alertDef';

const timeFormatter = (value: number, timeZone: string) =>
  dateTimeFormat(value, {
    format: systemDateFormats.fullDate,
    timeZone,
  });

export type AnnotationVals = {};

export function getAnnotationTooltip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annoVals: Record<string, any[]>,
  annoIdx: number,
  timeZone: string,
  canEditAnnotations: (dsUID: string) => boolean,
  canDeleteAnnotations: (dsUID: string) => boolean,
  onAnnotationDelete?: (id: string) => void
) {
  const annoId = annoVals.id?.[annoIdx];
  // const { canEditAnnotations = retFalse, canDeleteAnnotations = retFalse, onAnnotationDelete } = usePanelContext();
  const dashboardUID = annoVals.dashboardUID?.[annoIdx];

  // grafana can be configured to load alert rules from loki. Those annotations cannot be edited or deleted. The id being 0 is the best indicator the annotation came from loki
  const canEdit = annoId && annoId > 0 && canEditAnnotations(dashboardUID);
  const canDelete = annoId && annoId > 0 && canDeleteAnnotations(dashboardUID) && onAnnotationDelete != null;

  let time: string = timeFormatter(annoVals.time[annoIdx], timeZone);
  let text: string = annoVals.text?.[annoIdx] ?? '';

  if (annoVals.isRegion?.[annoIdx]) {
    time += ' - ' + timeFormatter(annoVals.timeEnd[annoIdx], timeZone);
  }

  // Alerting specific
  const alertId = annoVals.alertId?.[annoIdx];
  const alertText = annoVals.data?.[annoIdx] ? alertDef.getAlertAnnotationText(annoVals.data[annoIdx]) : '';
  const newState: string = annoVals.newState?.[annoIdx];
  const alertState = alertId !== undefined && newState ? newState : undefined;

  const title = annoVals.title?.[annoIdx];
  const avatarImgSrc: string =
    annoVals.login?.[annoIdx] && annoVals.avatarUrl[annoIdx] ? annoVals.avatarUrl[annoIdx] : undefined;

  return {
    title,
    onDelete: onAnnotationDelete ? () => onAnnotationDelete(annoId) : undefined,
    canEdit,
    canDelete,
    time,
    text,
    alertText,
    alertState,
    avatarImgSrc,
  };
}
