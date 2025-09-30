import { css } from '@emotion/css';
import { autoUpdate } from '@floating-ui/dom';
import { useFloating } from '@floating-ui/react';
import { useState } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { ClickOutsideWrapper, floatingUtils, useStyles2 } from '@grafana/ui';

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
  pinAnnotation: (pin: boolean) => void;
  isPinned: boolean;
  showOnHover: boolean;
  links?: LinkModel[];
}

export const AnnotationMarker2 = ({
  annoVals,
  annoIdx,
  className,
  style,
  exitWipEdit,
  timeZone,
  portalRoot,
  pinAnnotation,
  isPinned,
  showOnHover,
  links,
}: AnnoBoxProps) => {
  const styles = useStyles2(getStyles);
  const placement = 'bottom';

  const [editing, setEditing] = useState(exitWipEdit != null);
  const [isHovering, setIsHovering] = useState(false);
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement,
    middleware: floatingUtils.getPositioningMiddleware(placement),
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const onClose = () => {
    pinAnnotation(false);
    setIsHovering(false);
  };

  const contents =
    (isPinned && !editing) || (showOnHover && isHovering && !editing) ? (
      <AnnotationTooltip2
        links={links}
        onClose={onClose}
        isPinned={isPinned}
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onEdit={() => setEditing(true)}
      />
    ) : editing ? (
      <AnnotationEditor2
        isPinned={isPinned}
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        dismiss={() => {
          exitWipEdit?.();
          setEditing(false);
          onClose();
        }}
      />
    ) : null;

  return (
    <button
      ref={refs.setReference}
      className={className}
      style={style!}
      onFocus={() => setIsHovering(true)}
      onBlur={() => setIsHovering(false)}
      onClick={() => pinAnnotation(true)}
      // @todo do we still want to support showing tooltip on hover?
      onMouseEnter={() => showOnHover && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={selectors.pages.Dashboard.Annotations.marker}
    >
      {contents &&
        createPortal(
          <div ref={refs.setFloating} className={styles.annoBox} style={floatingStyles} data-testid="annotation-marker">
            {/*
               @TODO close on annotation click doesn't unpin
               Currently the click outside prevents clicking on the annotation while pinned to close,
               as the click outside pinAnnotations call will set the pinned state before the onClick event is sent
               */}
            <ClickOutsideWrapper includeButtonPress={false} useCapture={true} onClick={() => pinAnnotation(false)}>
              {contents}
            </ClickOutsideWrapper>
          </div>,
          portalRoot,
          'annotations-plugin-tooltip'
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
