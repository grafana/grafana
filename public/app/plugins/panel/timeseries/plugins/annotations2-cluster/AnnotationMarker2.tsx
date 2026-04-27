import { css } from '@emotion/css';
import { autoUpdate } from '@floating-ui/dom';
import { useFloating } from '@floating-ui/react';
import * as React from 'react';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

import { type DataFrame } from '@grafana/data/dataframe';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { ActionModel, InterpolateFunction, LinkModel } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type TimeZone } from '@grafana/schema';
import { ClickOutsideWrapper } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { floatingUtils } from '@grafana/ui/utils';
import { getDataLinks, getFieldActions } from 'app/plugins/panel/status-history/utils';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';
import { AnnotationTooltip2Cluster } from './AnnotationTooltip2Cluster';
import { type AnnotationVals } from './types';

interface AnnotationMarkerProps {
  // Annotation dataframe
  frame: DataFrame;
  // The values from the annotation fields
  annoVals: AnnotationVals;
  // The value index, sometimes called rowIndex
  annoIdx: number;
  // Styles calculated from plot, e.g. calculated region width & annotation offset
  style: React.CSSProperties | null;
  // Method to close user created (wip) annotation
  exitWipEdit?: null | (() => void);
  // From PanelContext.canExecuteActions(), controls whether the user has permission to execute field actions
  canExecuteActions: boolean;
  // Sets if the user pinned via keyboard or mouse click
  setPinned: (pin: boolean) => void;
  // Current pin state
  isPinned: boolean;
  // Determines if we should display the tooltip when hovering, keeps adjacent annotations from rendering a tooltip that overlays the pinned tooltip
  showTooltipOnHover: boolean;
  timeZone: TimeZone;
  portalRoot: HTMLElement;
  replaceVariables: InterpolateFunction;
}

export const AnnotationMarker2 = ({
  frame,
  annoVals,
  annoIdx,
  style,
  exitWipEdit,
  timeZone,
  portalRoot,
  replaceVariables,
  canExecuteActions,
  setPinned,
  showTooltipOnHover,
  isPinned,
}: AnnotationMarkerProps) => {
  const styles = useStyles2(getStyles);
  const placement = 'bottom';
  const isRegion = annoVals?.isRegion?.[annoIdx] === true;

  // Set when editing
  const [editAnnotationId, setEditAnnotationId] = useState(exitWipEdit != null ? annoIdx : null);
  const [isHovering, setIsHovering] = useState(false);
  const isClustering =
    annoVals.isCluster?.[annoIdx] && annoVals.clusterIdx?.[annoIdx] != null && annoVals.clusterIdx?.[annoIdx] > -1;

  const { refs, floatingStyles } = useFloating({
    open: true,
    placement,
    middleware: floatingUtils.getPositioningMiddleware(placement),
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const onClose = () => {
    setPinned(false);
    setIsHovering(false);
  };
  const links: LinkModel[] = [];
  const actions: ActionModel[] = [];

  if (isHovering || isPinned) {
    frame.fields.forEach((field) => {
      // Since field overrides are not yet supported for annotation frames, every value in the field will have the same links... except the clustering index because it's generated on-the-fly and not had getFieldOverrides called on it
      const annotationIndexForLinks = isClustering ? 0 : annoIdx;

      // @todo https://github.com/grafana/grafana/issues/119619, need to set getLinks on field, or applyFieldOverrides on dataframe
      links.push(...getDataLinks(field, annotationIndexForLinks));

      if (canExecuteActions) {
        actions.push(...getFieldActions(frame, field, replaceVariables, annotationIndexForLinks));
      }
    });
  }

  const isEditing = editAnnotationId !== null;
  const showTooltip = (isPinned && !isEditing) || (showTooltipOnHover && isHovering && !isEditing);

  // We cannot use the array index for editing annotations since clustered and wip annotations will get sorted by date, so we need to grab them by the 'id' field which is populated by the annotations API
  const annoId = annoVals?.id?.[annoIdx];
  const _editIdx = annoVals?.id?.findIndex((annoId) => annoId === editAnnotationId);
  // wip will not have an id to set, so we need to pass in the raw idx of this annotation, as long as wip is not already clustered, this should continue to work
  const editIdx = _editIdx !== undefined && _editIdx > -1 ? _editIdx : annoIdx;

  let contents: ReactNode | null = null;
  if (!isEditing && showTooltip && isClustering) {
    contents = (
      <AnnotationTooltip2Cluster
        actions={actions}
        links={links}
        onClose={onClose}
        isPinned={isPinned}
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onEdit={(annotationId: number) => setEditAnnotationId(annotationId)}
      />
    );
  } else if (showTooltip) {
    contents = (
      <AnnotationTooltip2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onClose={onClose}
        isPinned={isPinned}
        onEdit={annoId !== undefined ? () => setEditAnnotationId(annoId) : undefined}
        links={links}
        actions={actions}
      />
    );
  } else if (isEditing) {
    contents = (
      <AnnotationEditor2
        annoIdx={editIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        dismiss={() => {
          exitWipEdit?.();
          setEditAnnotationId(null);
          onClose();
        }}
      />
    );
  }

  return (
    <button
      aria-label={
        isRegion
          ? t('timeseries.annotation-marker.annotation-region-label', 'Annotation region')
          : t('timeseries.annotation-marker.annotation-label', 'Annotation')
      }
      ref={refs.setReference}
      className={isRegion ? styles.annoRegion : styles.annoMarker}
      style={style!}
      onFocus={() => setIsHovering(true)}
      onBlur={() => setIsHovering(false)}
      onClick={() => setPinned(true)}
      onMouseEnter={() => showTooltipOnHover && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={selectors.pages.Dashboard.Annotations.marker}
    >
      {contents &&
        createPortal(
          <div ref={refs.setFloating} className={styles.annoBox} style={floatingStyles} data-testid="annotation-marker">
            <ClickOutsideWrapper includeButtonPress={false} useCapture={true} onClick={() => setPinned(false)}>
              {contents}
            </ClickOutsideWrapper>
          </div>,
          portalRoot
        )}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annoMarker: css({
    position: 'absolute',
    width: 0,
    height: 0,
    border: 'none',
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderBottomWidth: '5px',
    borderBottomStyle: 'solid',
    transform: 'translateX(-50%)',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
  annoRegion: css({
    border: 'none',
    position: 'absolute',
    height: '5px',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
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
