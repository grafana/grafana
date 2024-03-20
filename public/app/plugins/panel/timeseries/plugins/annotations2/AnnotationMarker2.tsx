import { css } from '@emotion/css';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';

import { dateTimeFormat, GrafanaTheme2, systemDateFormats } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { usePanelContext, useStyles2 } from '@grafana/ui';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';

interface AnnoBoxProps {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  timezone: TimeZone;
  exitWipEdit?: null | (() => void);
}

const STATE_DEFAULT = 0;
const STATE_EDITING = 1;
const STATE_HOVERED = 2;

export const AnnotationMarker2 = ({ annoVals, annoIdx, className, style, exitWipEdit, timezone }: AnnoBoxProps) => {
  const { canEditAnnotations, canDeleteAnnotations, ...panelCtx } = usePanelContext();

  const styles = useStyles2(getStyles);

  const [state, setState] = useState(STATE_DEFAULT);

  const clickAwayRef = useRef(null);

  useClickAway(clickAwayRef, () => {
    if (state === STATE_EDITING) {
      setIsEditingWrap(false);
    }
  });

  const domRef = React.createRef<HTMLDivElement>();

  // similar to TooltipPlugin2, when editing annotation (pinned), it should boost z-index
  const setIsEditingWrap = useCallback(
    (isEditing: boolean) => {
      setState(isEditing ? STATE_EDITING : STATE_DEFAULT);
      if (!isEditing && exitWipEdit != null) {
        exitWipEdit();
      }
    },
    [exitWipEdit]
  );

  const onAnnotationEdit = useCallback(() => {
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

  useLayoutEffect(
    () => {
      if (exitWipEdit != null) {
        setIsEditingWrap(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renderAnnotationTooltip = useCallback(() => {
    let dashboardUID = annoVals.dashboardUID?.[annoIdx];

    return (
      <AnnotationTooltip2
        timeFormatter={timeFormatter}
        onEdit={onAnnotationEdit}
        onDelete={onAnnotationDelete}
        canEdit={canEditAnnotations ? canEditAnnotations(dashboardUID) : false}
        canDelete={canDeleteAnnotations ? canDeleteAnnotations(dashboardUID) : false}
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
      <AnnotationEditor2
        dismiss={() => setIsEditingWrap(false)}
        timeFormatter={timeFormatter}
        annoIdx={annoIdx}
        annoVals={annoVals}
      />
    );
  }, [annoIdx, annoVals, timeFormatter, setIsEditingWrap]);

  return (
    <div
      ref={domRef}
      className={className}
      style={style!}
      onMouseEnter={() => state !== STATE_EDITING && setState(STATE_HOVERED)}
      onMouseLeave={() => state !== STATE_EDITING && setState(STATE_DEFAULT)}
    >
      <div className={styles.annoInfo} ref={clickAwayRef}>
        {state === STATE_HOVERED && renderAnnotationTooltip()}
        {state === STATE_EDITING && renderAnnotationEditor()}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annoInfo: css({
    background: theme.colors.background.secondary,
    minWidth: '300px',
    // maxWidth: '400px',
    position: 'absolute',
    top: '5px',
    left: '50%',
    transform: 'translateX(-50%)',
  }),
});
