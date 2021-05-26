import React, { CSSProperties, useCallback, useRef, useState } from 'react';
import { GrafanaTheme2, dateTimeFormat, systemDateFormats, TimeZone, textUtil, getColorForTheme } from '@grafana/data';
import { HorizontalGroup, Portal, Tag, VizTooltipContainer, useStyles2, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
import alertDef from 'app/features/alerting/state/alertDef';

interface Props {
  timeZone: TimeZone;
  annotation: AnnotationsDataFrameViewDTO;
}

export function AnnotationMarker({ annotation, timeZone }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getAnnotationMarkerStyles);
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const annotationPopoverRef = useRef<HTMLDivElement>(null);
  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  const onMouseEnter = useCallback(() => {
    if (popoverRenderTimeout.current) {
      clearTimeout(popoverRenderTimeout.current);
    }
    setIsOpen(true);
  }, [setIsOpen]);

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

  const markerStyles: CSSProperties = {
    width: 0,
    height: 0,
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderBottom: `4px solid ${getColorForTheme(annotation.color, theme.v1)}`,
    pointerEvents: 'none',
  };

  const renderMarker = useCallback(() => {
    if (!markerRef?.current) {
      return null;
    }

    const el = markerRef.current;
    const elBBox = el.getBoundingClientRect();
    const time = timeFormatter(annotation.time);
    let text = annotation.text;
    const tags = annotation.tags;
    let alertText = '';
    let state: React.ReactNode | null = null;

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

    return (
      <VizTooltipContainer
        position={{ x: elBBox.left, y: elBBox.top + elBBox.height }}
        offset={{ x: 0, y: 0 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.tooltip}
      >
        <div ref={annotationPopoverRef} className={styles.wrapper}>
          <div className={styles.header}>
            {state}
            {time && <span className={styles.time}>{time}</span>}
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
  }, [onMouseEnter, onMouseLeave, timeFormatter, styles, annotation]);

  return (
    <>
      <div ref={markerRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={styles.markerWrapper}>
        <div style={markerStyles} />
      </div>
      {isOpen && <Portal>{renderMarker()}</Portal>}
    </>
  );
}

const getAnnotationMarkerStyles = (theme: GrafanaTheme2) => {
  return {
    markerWrapper: css`
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
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
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
