import { css } from '@emotion/css';

import { ActionModel, GrafanaTheme2, LinkModel } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { VizTooltipFooter } from '@grafana/ui/internal';

import { AnnotationTooltipBody } from './AnnotationTooltipBody';
import { AnnotationTooltipHeader } from './AnnotationTooltipHeader';
import { getAnnotationTooltip } from './getAnnotationTooltip';

export interface AnnotationTooltipProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeZone: string;
  isPinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  links?: LinkModel[];
  actions?: ActionModel[];
}

const retFalse = () => false;

export const AnnotationTooltip2 = ({
  annoVals,
  annoIdx,
  timeZone,
  isPinned,
  onClose,
  onEdit,
  links = [],
  actions = [],
}: AnnotationTooltipProps) => {
  const styles = useStyles2(getStyles);
  const { canEditAnnotations = retFalse, canDeleteAnnotations = retFalse, onAnnotationDelete } = usePanelContext();
  let { onDelete, canEdit, canDelete, time, text, alertText, alertState, avatarImgSrc, title } = getAnnotationTooltip(
    annoVals,
    annoIdx,
    timeZone,
    canEditAnnotations,
    canDeleteAnnotations,
    onAnnotationDelete
  );

  return (
    <div className={styles.wrapper}>
      <AnnotationTooltipHeader
        avatarImg={avatarImgSrc}
        alertState={alertState}
        timeRange={time}
        canEdit={canEdit}
        canDelete={canDelete}
        isPinned={isPinned}
        onEdit={onEdit}
        onDelete={onDelete}
        onRemove={(e) => {
          // Don't trigger onClick
          e.stopPropagation();
          onClose();
        }}
      />

      <AnnotationTooltipBody title={title} text={text} alertText={alertText} tags={annoVals.tags} annoIdx={annoIdx} />

      {(links.length > 0 || actions.length > 0) && <VizTooltipFooter dataLinks={links} actions={actions} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'initial',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    userSelect: 'text',
  }),
});
