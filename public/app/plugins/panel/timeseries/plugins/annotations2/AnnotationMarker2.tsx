import { css } from '@emotion/css';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { getPortalContainer, useStyles2 } from '@grafana/ui';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';

interface AnnoBoxProps {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  timeZone: TimeZone;
  exitWipEdit?: null | (() => void);
}

const STATE_DEFAULT = 0;
const STATE_EDITING = 1;
const STATE_HOVERED = 2;

export const AnnotationMarker2 = ({ annoVals, annoIdx, className, style, exitWipEdit, timeZone }: AnnoBoxProps) => {
  const styles = useStyles2(getStyles);

  const [state, setState] = useState(exitWipEdit != null ? STATE_EDITING : STATE_DEFAULT);

  const domRef = React.createRef<HTMLDivElement>();

  const portalRoot = useRef<HTMLElement | null>(null);

  if (portalRoot.current == null) {
    portalRoot.current = getPortalContainer();
  }

  const containerStyle: React.CSSProperties = {
    transform: 'translateX(300px) translateY(300px)',
  };

  const contents =
    state === STATE_HOVERED ? (
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
    ) : null;

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
          <div className={styles.annoBox} style={containerStyle}>
            {contents}
          </div>,
          portalRoot.current!
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
