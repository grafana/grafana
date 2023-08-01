import { css } from '@emotion/css';
import React, { HTMLAttributes, useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

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

const POPPER_CONFIG = {
  modifiers: [
    { name: 'arrow', enabled: false },
    {
      name: 'preventOverflow',
      enabled: true,
      options: {
        rootBoundary: 'viewport',
      },
    },
  ],
};

export function AnnotationMarker({ annotation, timeZone, width }: Props) {
  const { canAddAnnotations, canEditAnnotations, canDeleteAnnotations, ...panelCtx } = usePanelContext();
  const commonStyles = useStyles2(getCommonAnnotationStyles);
  const styles = useStyles2(getStyles);

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [markerRef, setMarkerRef] = useState<HTMLDivElement | null>(null);
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);
  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);

  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  const popper = usePopper(markerRef, tooltipRef, POPPER_CONFIG);
  const editorPopper = usePopper(markerRef, editorRef, POPPER_CONFIG);

  const onAnnotationEdit = useCallback(() => {
    setIsEditing(true);
    setIsOpen(false);
  }, [setIsEditing, setIsOpen]);

  const onAnnotationDelete = useCallback(() => {
    if (panelCtx.onAnnotationDelete) {
      panelCtx.onAnnotationDelete(annotation.id);
    }
  }, [annotation, panelCtx]);

  const onMouseEnter = useCallback(() => {
    if (popoverRenderTimeout.current) {
      clearTimeout(popoverRenderTimeout.current);
    }
    setIsOpen(true);
  }, [setIsOpen]);

  const onPopoverMouseEnter = useCallback(() => {
    if (popoverRenderTimeout.current) {
      clearTimeout(popoverRenderTimeout.current);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    popoverRenderTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [setIsOpen]);

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
        canEdit={canEditAnnotations!(annotation.dashboardUID)}
        canDelete={canDeleteAnnotations!(annotation.dashboardUID)}
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
        ref={setMarkerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={!isRegionAnnotation ? styles.markerWrapper : undefined}
        data-testid={selectors.pages.Dashboard.Annotations.marker}
      >
        {marker}
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={setTooltipRef}
            style={popper.styles.popper}
            {...popper.attributes.popper}
            className={styles.tooltip}
            onMouseEnter={onPopoverMouseEnter}
            onMouseLeave={onMouseLeave}
          >
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
            ref={setEditorRef}
            style={editorPopper.styles.popper}
            {...editorPopper.attributes.popper}
          />
        </Portal>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    markerWrapper: css`
      label: markerWrapper;
      padding: 0 4px 4px 4px;
    `,
    wrapper: css`
      max-width: 400px;
    `,
    tooltip: css`
      ${getTooltipContainerStyles(theme)};
      padding: 0;
    `,
  };
};
