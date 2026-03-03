import { css } from '@emotion/css';
import { autoUpdate } from '@floating-ui/dom';
import { useFloating } from '@floating-ui/react';
import * as React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { ActionModel, DataFrame, GrafanaTheme2, InterpolateFunction, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { ClickOutsideWrapper, floatingUtils, useStyles2 } from '@grafana/ui';
import { getDataLinks, getFieldActions } from 'app/plugins/panel/status-history/utils';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';
import { AnnotationTooltip2Cluster } from './AnnotationTooltip2Cluster';

interface AnnoBoxProps {
  frame: DataFrame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  timeZone: TimeZone;
  exitWipEdit?: null | (() => void);
  portalRoot: HTMLElement;
  canExecuteActions: boolean;
  replaceVariables: InterpolateFunction;
  pinAnnotation: (pin: boolean) => void;
  isPinned: boolean;
  showOnHover: boolean;
}
const STATE_DEFAULT = 0;
const STATE_EDITING = 1;

export const AnnotationMarker2 = ({
  frame,
  annoVals,
  annoIdx,
  className,
  style,
  exitWipEdit,
  timeZone,
  portalRoot,
  replaceVariables,
  canExecuteActions,
  pinAnnotation,
  showOnHover,
  isPinned,
}: AnnoBoxProps) => {
  const styles = useStyles2(getStyles);
  const placement = 'bottom';

  const [isEditing, setIsEditing] = useState(exitWipEdit != null ? STATE_EDITING : STATE_DEFAULT);
  const [isHovering, setIsHovering] = useState(false);
  // @todo find what is setting null vs undefined
  const isClustering =
    annoVals.isRegion[annoIdx] &&
    annoVals.clusterIdx?.[annoIdx] !== null &&
    annoVals.clusterIdx?.[annoIdx] !== undefined &&
    annoVals.clusterIdx?.[annoIdx] > -1;

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
  const links: LinkModel[] = [];
  const actions: ActionModel[] = [];

  if (isHovering) {
    frame.fields.forEach((field) => {
      links.push(...getDataLinks(field, annoIdx));

      if (canExecuteActions) {
        actions.push(...getFieldActions(frame, field, replaceVariables, annoIdx));
      }
    });
  }

  const showTooltip =
    (isPinned && !(isEditing === STATE_EDITING)) || (showOnHover && isHovering && !(isEditing === STATE_EDITING));

  const contents =
    showTooltip && isClustering ? (
      <AnnotationTooltip2Cluster
        actions={actions}
        links={links}
        onClose={onClose}
        isPinned={isPinned}
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onEdit={() => setIsEditing(STATE_EDITING)}
      />
    ) : showTooltip ? (
      <AnnotationTooltip2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onClose={onClose}
        isPinned={isPinned}
        onEdit={() => setIsEditing(STATE_EDITING)}
        links={links}
        actions={actions}
      />
    ) : isEditing === STATE_EDITING ? (
      <AnnotationEditor2
        isPinned={isPinned}
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        dismiss={() => {
          exitWipEdit?.();
          setIsEditing(STATE_DEFAULT);
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
      onMouseEnter={() => showOnHover && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={selectors.pages.Dashboard.Annotations.marker}
    >
      {contents &&
        createPortal(
          <div ref={refs.setFloating} className={styles.annoBox} style={floatingStyles} data-testid="annotation-marker">
            <ClickOutsideWrapper includeButtonPress={false} useCapture={true} onClick={() => pinAnnotation(false)}>
              {contents}
            </ClickOutsideWrapper>
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
