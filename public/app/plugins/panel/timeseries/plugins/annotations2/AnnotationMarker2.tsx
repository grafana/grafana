import { css } from '@emotion/css';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';

import { dateTimeFormat, GrafanaTheme2, systemDateFormats, TimeZone } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';

import { AnnotationEditor } from './AnnotationEditor';
import { AnnotationTooltip2 } from './AnnotationTooltip2';

interface AnnoBoxProps {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  isWip?: boolean;
  timezone: TimeZone;
}

export const AnnotationMarker2 = ({ annoVals, annoIdx, className, style, isWip, timezone }: AnnoBoxProps) => {
  const { canEditAnnotations, canDeleteAnnotations, ...panelCtx } = usePanelContext();

  const styles = useStyles2(getStyles);

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const clickAwayRef = useRef(null);

  useClickAway(clickAwayRef, () => {
    setIsEditing(false);
  });

  const domRef = React.createRef<HTMLDivElement>();

  // similar to TooltipPlugin2, when editing annotation (pinned), it should boost z-index
  const setIsEditingWrap = useCallback(
    (isEditing: boolean) => {
      domRef.current!.closest<HTMLDivElement>('.react-grid-item')?.classList.toggle('context-menu-open', isEditing);
      setIsEditing(isEditing);
    },
    [domRef]
  );

  const onAnnotationEdit = useCallback(() => {
    setIsEditing(true);
    setIsHovered(false);
    setIsEditingWrap(true);
  }, [setIsEditingWrap]);

  const onAnnotationDelete = useCallback(() => {
    if (panelCtx.onAnnotationDelete) {
      panelCtx.onAnnotationDelete(annoVals.id?.[annoIdx]);
    }
  }, [annoIdx, annoVals.id, panelCtx]);

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone: timezone,
      });
    },
    [timezone]
  );

  // doesnt work to auto-activate edit mode? :(
  useLayoutEffect(
    () => {
      isWip && setIsEditingWrap(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renderAnnotationTooltip = useCallback(() => {
    return (
      <AnnotationTooltip2
        timeFormatter={timeFormatter}
        onEdit={onAnnotationEdit}
        onDelete={onAnnotationDelete}
        canEdit={canEditAnnotations ? canEditAnnotations(annoVals.dashboardUID?.[annoIdx]) : false}
        canDelete={canDeleteAnnotations ? canDeleteAnnotations(annoVals.dashboardUID?.[annoIdx]) : false}
        annoIdx={annoIdx}
        annoVals={annoVals}
      />
    );
  }, [
    timeFormatter,
    onAnnotationEdit,
    onAnnotationDelete,
    canEditAnnotations,
    annoVals,
    annoIdx,
    canDeleteAnnotations,
  ]);

  const renderAnnotationEditor = useCallback(() => {
    return (
      <AnnotationEditor
        onDismiss={() => setIsEditing(false)}
        onSave={() => setIsEditing(false)}
        timeFormatter={timeFormatter}
        annoIdx={annoIdx}
        annoVals={annoVals}
      />
    );
  }, [annoIdx, annoVals, timeFormatter]);

  return (
    <div
      ref={domRef}
      className={className}
      style={style!}
      onMouseEnter={() => !isEditing && setIsHovered(true)}
      onMouseLeave={() => !isEditing && setIsHovered(false)}
    >
      <div className={styles.annoInfo} ref={clickAwayRef}>
        {isHovered && renderAnnotationTooltip()}
        {isEditing && renderAnnotationEditor()}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annoInfo: css({
    background: theme.colors.background.secondary,
    minWidth: '300px',
    maxWidth: '400px',
    position: 'absolute',
    top: '5px',
    left: '50%',
    transform: 'translateX(-50%)',
  }),
});
