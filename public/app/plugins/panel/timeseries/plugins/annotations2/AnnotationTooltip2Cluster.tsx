import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';
import { VizTooltipFooter } from '@grafana/ui/internal';
import alertDef from 'app/features/alerting/state/alertDef';

import { AnnotationTooltipProps } from './AnnotationTooltip2';
import { AnnotationTooltipBody } from './AnnotationTooltipBody';
import { AnnotationTooltipHeader } from './AnnotationTooltipHeader';
import { useAnnotationTooltip } from './useAnnotationTooltip';

export const AnnotationTooltip2Cluster = ({
  annoVals,
  annoIdx,
  timeZone,
  onEdit,
  isPinned,
  onClose,
  links,
  actions,
}: AnnotationTooltipProps) => {
  const styles = useStyles2(getStyles);
  let { onAnnotationDelete, canEdit, canDelete, time, alertState, avatarImgSrc } = useAnnotationTooltip(
    annoVals,
    annoIdx,
    timeZone
  );

  let items: React.ReactNode[] = [];

  let clusterIdx = annoVals.clusterIdx[annoIdx];

  for (let i = 0; i < annoVals.time.length; i++) {
    if (annoVals.clusterIdx[i] === clusterIdx && i !== annoIdx) {
      let text = annoVals.text?.[i] ?? '';
      let alertText = '';

      if (annoVals.alertId?.[i] !== undefined && annoVals.newState?.[i]) {
        alertText = annoVals.data?.[i] ? alertDef.getAlertAnnotationText(annoVals.data[i]) : '';
      } else if (annoVals.title?.[i]) {
        text = annoVals.title[i] + (text ? `<br />${text}` : '');
      }

      items.push(
        <AnnotationTooltipBody key={i} text={text} alertText={alertText} tags={annoVals.tags} annoIdx={annoIdx} />
      );
    }
  }

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
        onDelete={onAnnotationDelete}
        onRemove={(e) => {
          // Don't trigger onClick
          e.stopPropagation();
          onClose();
        }}
      />

      <ScrollContainer maxHeight="200px">{items}</ScrollContainer>

      <VizTooltipFooter actions={actions} dataLinks={links ?? []} />
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
  header: css({
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.fontSize,
    color: theme.colors.text.primary,
    display: 'flex',
  }),
  meta: css({
    display: 'flex',
    color: theme.colors.text.primary,
    fontWeight: 400,
  }),
  controls: css({
    display: 'flex',
    '> :last-child': {
      marginLeft: 0,
    },
  }),
  body: css({
    label: 'cluster-annotation-body',
    padding: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: 400,
    a: {
      color: theme.colors.text.link,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  }),
  text: css({
    paddingBottom: theme.spacing(1),
  }),
  avatar: css({
    borderRadius: theme.shape.radius.circle,
    width: 16,
    height: 16,
    marginRight: theme.spacing(1),
  }),
  alertState: css({
    paddingRight: theme.spacing(1),
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
