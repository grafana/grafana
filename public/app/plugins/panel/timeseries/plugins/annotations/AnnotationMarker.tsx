import React, { useCallback, useRef, useState } from 'react';
import { GrafanaTheme2, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { Portal, useStyles2, usePanelContext, usePlotContext } from '@grafana/ui';
import { css } from '@emotion/css';
import { AnnotationEditorForm } from './AnnotationEditorForm';
import { getCommonAnnotationStyles } from '../styles';
import { usePopper } from 'react-popper';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';
import { AnnotationTooltip } from './AnnotationTooltip';

interface Props {
  timeZone: TimeZone;
  annotation: AnnotationsDataFrameViewDTO;
}

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

export function AnnotationMarker({ annotation, timeZone }: Props) {
  const commonStyles = useStyles2(getCommonAnnotationStyles);
  const styles = useStyles2(getStyles);
  const plotCtx = usePlotContext();
  const { canAddAnnotations, ...panelCtx } = usePanelContext();

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
        editable={Boolean(canAddAnnotations && canAddAnnotations())}
      />
    );
  }, [canAddAnnotations, onAnnotationDelete, onAnnotationEdit, timeFormatter, annotation]);

  const isRegionAnnotation = Boolean(annotation.isRegion);

  let marker = (
    <div className={commonStyles(annotation).markerTriangle} style={{ transform: 'translate3d(-100%,-50%, 0)' }} />
  );

  if (isRegionAnnotation && plotCtx.plot) {
    let x0 = plotCtx.plot!.valToPos(annotation.time, 'x');
    let x1 = plotCtx.plot!.valToPos(annotation.timeEnd, 'x');

    // markers are rendered relatively to uPlot canvas overly, not caring about axes width
    if (x0 < 0) {
      x0 = 0;
    }

    if (x1 > plotCtx.plot!.bbox.width / window.devicePixelRatio) {
      x1 = plotCtx.plot!.bbox.width / window.devicePixelRatio;
    }

    marker = (
      <div
        className={commonStyles(annotation).markerBar}
        style={{ width: `${x1 - x0}px`, transform: 'translate3d(0,-50%, 0)' }}
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
