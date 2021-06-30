import React, { useCallback, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { GrafanaTheme2, dateTimeFormat, systemDateFormats, TimeZone, textUtil } from '@grafana/data';
import {
  HorizontalGroup,
  Portal,
  Tag,
  VizTooltipContainer,
  useStyles2,
  usePanelContext,
  IconButton,
  usePlotContext,
} from '@grafana/ui';
import { css } from '@emotion/css';
import alertDef from 'app/features/alerting/state/alertDef';
import { AnnotationEditorForm } from './AnnotationEditor';
import { getCommonAnnotationStyles } from './styles';

interface Props {
  timeZone: TimeZone;
  annotation: AnnotationsDataFrameViewDTO;
}

export function AnnotationMarker({ annotation, timeZone }: Props) {
  const commonStyles = useStyles2(getCommonAnnotationStyles);
  const styles = useStyles2(getAnnotationMarkerStyles);
  const plotCtx = usePlotContext();
  const { canAddAnnotations, ...panelCtx } = usePanelContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const annotationPopoverRef = useRef<HTMLDivElement>(null);
  const popoverRenderTimeout = useRef<NodeJS.Timer>();
  const editorRef = useRef(null);

  useClickAway(editorRef, () => {
    setIsEditing(false);
  });

  const deleteAnnotation = useCallback(() => {
    if (panelCtx.deleteAnnotation) {
      panelCtx.deleteAnnotation(annotation.id);
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

  const renderMarker = useCallback(() => {
    if (!markerRef?.current) {
      return null;
    }

    const el = markerRef.current;
    const elBBox = el.getBoundingClientRect();
    const time = timeFormatter(annotation.time);
    const timeEnd = timeFormatter(annotation.timeEnd);
    let text = annotation.text;
    const tags = annotation.tags;
    let alertText = '';
    let avatar;
    let editControls;
    let state: React.ReactNode | null = null;

    const ts = <span className={styles.time}>{Boolean(annotation.isRegion) ? `${time} - ${timeEnd}` : time}</span>;

    if (annotation.login && annotation.avatarUrl) {
      avatar = <img className={styles.avatar} src={annotation.avatarUrl} />;
    }

    if (annotation.alertId) {
      const stateModel = alertDef.getStateDisplayModel(annotation.newState!);
      state = (
        <div className={styles.alertState}>
          <i className={stateModel.stateClass}>{stateModel.text}</i>
        </div>
      );

      alertText = alertDef.getAlertAnnotationInfo(annotation);
    } else if (annotation.title) {
      text = annotation.title + '<br />' + (typeof text === 'string' ? text : '');
    }

    if (canAddAnnotations()) {
      editControls = (
        <div className={styles.editControls}>
          <IconButton
            name={'pen'}
            onClick={() => {
              setIsEditing(true);
              setIsOpen(false);
            }}
          />
          <IconButton name={'trash-alt'} onClick={deleteAnnotation} />
        </div>
      );
    }

    return (
      <VizTooltipContainer
        position={{ x: elBBox.left, y: elBBox.top + elBBox.height }}
        offset={{ x: 0, y: 0 }}
        onMouseEnter={onPopoverMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.tooltip}
      >
        <div ref={annotationPopoverRef} className={styles.wrapper}>
          <div className={styles.header}>
            <HorizontalGroup justify={'space-between'} align={'center'} spacing={'md'}>
              <div className={styles.meta}>
                <span>
                  {avatar}
                  {state}
                </span>
                {ts}
              </div>
              {editControls}
            </HorizontalGroup>
          </div>

          <div className={styles.body}>
            {text && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
            {alertText}
            <>
              <HorizontalGroup spacing="xs" wrap>
                {tags?.map((t, i) => (
                  <Tag name={t} key={`${t}-${i}`} />
                ))}
              </HorizontalGroup>
            </>
          </div>
        </div>
      </VizTooltipContainer>
    );
  }, [onMouseLeave, onPopoverMouseEnter, canAddAnnotations, deleteAnnotation, timeFormatter, styles, annotation]);

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
        ref={markerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={!isRegionAnnotation ? styles.markerWrapper : undefined}
      >
        {marker}
      </div>
      {isOpen && <Portal>{renderMarker()}</Portal>}
      {isEditing && (
        <Portal>
          <AnnotationEditorForm
            onDismiss={() => setIsEditing(false)}
            onSave={() => setIsEditing(false)}
            timeFormatter={timeFormatter}
            annotation={annotation}
            ref={editorRef}
            className={getEditorPositionStyles(markerRef.current?.getBoundingClientRect())}
          />
        </Portal>
      )}
    </>
  );
}

const getAnnotationMarkerStyles = (theme: GrafanaTheme2) => {
  return {
    markerWrapper: css`
      label: markerWrapper;
      padding: 0 4px 4px 4px;
    `,
    wrapper: css`
      max-width: 400px;
    `,
    tooltip: css`
      padding: 0;
    `,
    header: css`
      padding: ${theme.spacing(0.5, 1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
    `,
    meta: css`
      display: flex;
      justify-content: space-between;
    `,
    editControls: css`
      display: flex;
      align-items: center;
      > :last-child {
        margin-right: 0;
      }
    `,
    avatar: css`
      border-radius: 50%;
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing(1)};
    `,
    alertState: css`
      padding-right: ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    time: css`
      color: ${theme.colors.text.secondary};
      font-style: italic;
      font-weight: normal;
      display: inline-block;
      position: relative;
      top: 1px;
    `,
    body: css`
      padding: ${theme.spacing(1)};
    `,
  };
};

const getEditorPositionStyles = (markerBBox?: DOMRect) => {
  if (!markerBBox) {
    return;
  }
  return css`
    position: absolute;
    left: ${markerBBox.left}px;
    top: ${markerBBox.top + markerBBox.height}px;
    transform: translate3d(-50%, 0, 0);
  `;
};
