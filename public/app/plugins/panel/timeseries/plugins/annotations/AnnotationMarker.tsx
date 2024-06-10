import { css } from '@emotion/css';
import {
  autoUpdate,
  flip,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import React, { HTMLAttributes, useCallback, useState } from 'react';

import { GrafanaTheme2, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Portal, useStyles2, usePanelContext } from '@grafana/ui';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';

import { getCommonAnnotationStyles } from '../styles';
import { AnnotationsDataFrameViewDTO } from '../types';

import { AnnotationEditorForm } from './AnnotationEditorForm';
import { AnnotationTooltip } from './AnnotationTooltip';

interface Props extends HTMLAttributes<HTMLDivElement> {
  timeZone: TimeZone;
  annotation: AnnotationsDataFrameViewDTO;
  width: number;
}

const MIN_REGION_ANNOTATION_WIDTH = 6;

export function AnnotationMarker({ annotation, timeZone, width }: Props) {
  const { canEditAnnotations, canDeleteAnnotations, ...panelCtx } = usePanelContext();
  const commonStyles = useStyles2(getCommonAnnotationStyles);
  const styles = useStyles2(getStyles);

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // the order of middleware is important!
  const middleware = [
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom',
    onOpenChange: setIsOpen,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const hover = useHover(context, {
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, hover]);

  const onAnnotationEdit = useCallback(() => {
    setIsEditing(true);
    setIsOpen(false);
  }, [setIsEditing, setIsOpen]);

  const onAnnotationDelete = useCallback(() => {
    if (panelCtx.onAnnotationDelete) {
      panelCtx.onAnnotationDelete(annotation.id);
    }
  }, [annotation, panelCtx]);

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  const renderTooltip = useCallback(() => {
    return (
      <AnnotationTooltip
        annotation={annotation}
        timeFormatter={timeFormatter}
        onEdit={onAnnotationEdit}
        onDelete={onAnnotationDelete}
        canEdit={canEditAnnotations ? canEditAnnotations(annotation.dashboardUID) : false}
        canDelete={canDeleteAnnotations ? canDeleteAnnotations(annotation.dashboardUID) : false}
      />
    );
  }, [canEditAnnotations, canDeleteAnnotations, onAnnotationDelete, onAnnotationEdit, timeFormatter, annotation]);

  const isRegionAnnotation = Boolean(annotation.isRegion) && width > MIN_REGION_ANNOTATION_WIDTH;

  let left = `${width / 2}px`;
  let marker = (
    <div
      className={commonStyles(annotation).markerTriangle}
      style={{ left, position: 'relative', transform: 'translate3d(-100%,-50%, 0)' }}
    />
  );

  if (isRegionAnnotation) {
    marker = (
      <div
        className={commonStyles(annotation).markerBar}
        style={{ width: `${width}px`, transform: 'translate3d(0,-50%, 0)' }}
      />
    );
  }
  return (
    <>
      <div
        ref={refs.setReference}
        className={!isRegionAnnotation ? styles.markerWrapper : undefined}
        data-testid={selectors.pages.Dashboard.Annotations.marker}
        {...getReferenceProps()}
      >
        {marker}
      </div>

      {isOpen && (
        <Portal>
          <div className={styles.tooltip} ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
            {renderTooltip()}
          </div>
        </Portal>
      )}

      {isEditing && (
        <Portal>
          <AnnotationEditorForm
            onDismiss={() => setIsEditing(false)}
            onSave={() => setIsEditing(false)}
            timeFormatter={timeFormatter}
            annotation={annotation}
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          />
        </Portal>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    markerWrapper: css({
      label: 'markerWrapper',
      padding: theme.spacing(0, 0.5, 0.5, 0.5),
    }),
    tooltip: css({
      ...getTooltipContainerStyles(theme),
      padding: 0,
    }),
  };
};
