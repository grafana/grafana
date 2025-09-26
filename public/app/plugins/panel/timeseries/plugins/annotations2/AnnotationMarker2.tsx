import { css } from '@emotion/css';
import { autoUpdate } from '@floating-ui/dom';
import { useFloating } from '@floating-ui/react';
import { useState } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { floatingUtils, useStyles2 } from '@grafana/ui';

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
  const placement = 'bottom';

  const [editing, setEditing] = useState(exitWipEdit != null);
  const [active, setActive] = useState(false);
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement,
    middleware: floatingUtils.getPositioningMiddleware(placement),
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const contents =
    active && !editing ? (
      <AnnotationTooltip2 annoIdx={annoIdx} annoVals={annoVals} timeZone={timeZone} onEdit={() => setEditing(true)} />
    ) : editing ? (
      <AnnotationEditor2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        dismiss={() => {
          exitWipEdit?.();
          setEditing(false);
        }}
      />
    ) : null;

  return (
    <button
      ref={refs.setReference}
      className={className}
      style={style!}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onClick={() => setActive(!active)}
      data-testid={selectors.pages.Dashboard.Annotations.marker}
    >
      {contents &&
        createPortal(
          <div ref={refs.setFloating} className={styles.annoBox} style={floatingStyles} data-testid="annotation-marker">
            {contents}
          </div>,
          portalRoot
        )}
    </button>
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
