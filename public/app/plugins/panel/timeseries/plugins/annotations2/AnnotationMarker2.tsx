import { css } from '@emotion/css';
import { autoUpdate } from '@floating-ui/dom';
import { useFloating } from '@floating-ui/react';
import { useState } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { ActionModel, DataFrame, GrafanaTheme2, InterpolateFunction, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { floatingUtils, useStyles2 } from '@grafana/ui';
import { getDataLinks, getFieldActions } from 'app/plugins/panel/status-history/utils';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { AnnotationTooltip2 } from './AnnotationTooltip2';

interface AnnoBoxProps {
  frame: DataFrame;
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  timeZone: TimeZone;
  exitWipEdit?: null | (() => void);
  portalRoot: HTMLElement;
  canExecuteActions: boolean;
  replaceVariables: InterpolateFunction;
}

const STATE_DEFAULT = 0;
const STATE_EDITING = 1;
const STATE_HOVERED = 2;

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
}: AnnoBoxProps) => {
  const styles = useStyles2(getStyles);
  const placement = 'bottom';

  const [state, setState] = useState(exitWipEdit != null ? STATE_EDITING : STATE_DEFAULT);
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement,
    middleware: floatingUtils.getPositioningMiddleware(placement),
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const links: LinkModel[] = [];
  const actions: ActionModel[] = [];

  if (STATE_HOVERED) {
    frame.fields.forEach((field) => {
      links.push(...getDataLinks(field, annoIdx));

      if (canExecuteActions) {
        actions.push(...getFieldActions(frame, field, replaceVariables, annoIdx));
      }
    });
  }

  const contents =
    state === STATE_HOVERED ? (
      <AnnotationTooltip2
        annoIdx={annoIdx}
        annoVals={annoVals}
        timeZone={timeZone}
        onEdit={() => setState(STATE_EDITING)}
        links={links}
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
      ref={refs.setReference}
      className={className}
      style={style!}
      onMouseEnter={() => state !== STATE_EDITING && setState(STATE_HOVERED)}
      onMouseLeave={() => state !== STATE_EDITING && setState(STATE_DEFAULT)}
      data-testid={selectors.pages.Dashboard.Annotations.marker}
    >
      {contents &&
        createPortal(
          <div ref={refs.setFloating} className={styles.annoBox} style={floatingStyles} data-testid="annotation-marker">
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
