import React, { useCallback, useRef, useState } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { HorizontalGroup, Portal, Tag, TooltipContainer, useStyles } from '@grafana/ui';
import { css } from 'emotion';

interface AnnotationMarkerProps {
  time: string;
  text: string;
  tags: string[];
}

export const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({ time, text, tags }) => {
  const styles = useStyles(getAnnotationMarkerStyles);
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

  const renderMarker = useCallback(() => {
    if (!markerRef?.current) {
      return null;
    }

    const el = markerRef.current;
    const elBBox = el.getBoundingClientRect();

    return (
      <TooltipContainer
        position={{ x: elBBox.left, y: elBBox.top + elBBox.height }}
        offset={{ x: 0, y: 0 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.tooltip}
      >
        <div ref={annotationPopoverRef} className={styles.wrapper}>
          <div className={styles.header}>
            {/*<span className={styles.title}>{annotationEvent.title}</span>*/}
            {time && <span className={styles.time}>{time}</span>}
          </div>
          <div className={styles.body}>
            {text && <div dangerouslySetInnerHTML={{ __html: text }} />}
            <>
              <HorizontalGroup spacing="xs" wrap>
                {tags?.map((t, i) => (
                  <Tag name={t} key={`${t}-${i}`} />
                ))}
              </HorizontalGroup>
            </>
          </div>
        </div>
      </TooltipContainer>
    );
  }, [time, tags, text]);

  return (
    <>
      <div ref={markerRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={styles.markerWrapper}>
        <div className={styles.marker} />
      </div>
      {isOpen && <Portal>{renderMarker()}</Portal>}
    </>
  );
};

const getAnnotationMarkerStyles = (theme: GrafanaTheme) => {
  const bg = theme.isDark ? theme.palette.dark2 : theme.palette.white;
  const headerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;
  const shadowColor = theme.isDark ? theme.palette.black : theme.palette.white;

  return {
    markerWrapper: css`
      padding: 0 4px 4px 4px;
    `,
    marker: css`
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid ${theme.palette.red};
      pointer-events: none;
    `,
    wrapper: css`
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.border.radius.md};
      max-width: 400px;
      box-shadow: 0 0 20px ${shadowColor};
    `,
    tooltip: css`
      background: none;
      padding: 0;
    `,
    header: css`
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
    title: css`
      font-weight: ${theme.typography.weight.semibold};
      padding-right: ${theme.spacing.md};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
    time: css`
      color: ${theme.colors.textWeak};
      font-style: italic;
      font-weight: normal;
      display: inline-block;
      position: relative;
      top: 1px;
    `,
    body: css`
      padding: ${theme.spacing.sm};
      font-weight: ${theme.typography.weight.semibold};
    `,
  };
};
