import { css } from '@emotion/css';
import React, { useState, useRef, useReducer } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';

interface AnnoBoxProps {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  timeZone: TimeZone;
  exitWipEdit?: null | (() => void);
  portalRoot: HTMLElement;
}

const STATE_DEFAULT = 0;
const STATE_EDITING = 1;
const STATE_HOVERED = 2;

export const AnnotationMarker2 = ({
  annoVals,
  annoIdx,
  className,
  style,
  exitWipEdit,
  timeZone,
  portalRoot,
}: AnnoBoxProps) => {
  const styles = useStyles2(getStyles);

  const [state, setState] = useState(exitWipEdit != null ? STATE_EDITING : STATE_DEFAULT);
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  const domRef = useRef<HTMLDivElement>(null);

  let posStyle = useRef<React.CSSProperties>({
    transform: undefined,
  });

  // this is cheaper than an unconditional useLayoutEffect in every marker
  if (state !== STATE_DEFAULT) {
    if (domRef.current != null) {
      let domRect = domRef.current.getBoundingClientRect();

      posStyle.current.transform = `translate(${domRect.left}px, ${domRect.top}px)`;
    } else {
      setTimeout(() => {
        forceUpdate();
      }, 0);
    }
  } else {
    posStyle.current.transform = undefined;
  }

  const contents =
    posStyle.current.transform &&
    (state === STATE_HOVERED ? (
      <AnnotationTooltip2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onEdit={() => setState(STATE_EDITING)}
      />
    ) : state === STATE_EDITING ? (
      <AnnotationEditor2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        dismiss={() => {
          exitWipEdit?.();
          setState(STATE_DEFAULT);
        }}
      />
    ) : null);

  return (
    <div
      ref={domRef}
      className={className}
      style={style!}
      onMouseEnter={() => state !== STATE_EDITING && setState(STATE_HOVERED)}
      onMouseLeave={() => state !== STATE_EDITING && setState(STATE_DEFAULT)}
    >
      {contents &&
        createPortal(
          <div className={styles.annoBox} style={posStyle.current}>
            {contents}
          </div>,
          portalRoot
        )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // NOTE: shares much with TooltipPlugin2
  annoBox: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    borderRadius: theme.shape.radius.default,
    position: 'absolute',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    userSelect: 'text',
    minWidth: '300px',
  }),
});
