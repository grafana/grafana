import { type AnnotationQuery } from '@grafana/schema';

export interface AnnotationDisplayValue {
  isHidden: boolean;
  placement?: 'inControlsMenu';
  hideLabel?: boolean;
}

export function isAnnotationLabelHidden(query: AnnotationQuery | undefined): boolean {
  return Boolean(query && Reflect.get(query, 'hideLabel'));
}

export function annotationQueryWithDisplay(query: AnnotationQuery, display: AnnotationDisplayValue): AnnotationQuery {
  const next: AnnotationQuery = {
    ...query,
    hide: display.isHidden,
    placement: display.placement,
  };

  if (display.hideLabel) {
    Reflect.set(next, 'hideLabel', true);
  } else {
    Reflect.deleteProperty(next, 'hideLabel');
  }

  return next;
}
