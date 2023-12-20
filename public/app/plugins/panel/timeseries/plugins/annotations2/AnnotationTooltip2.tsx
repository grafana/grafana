import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { HorizontalGroup, IconButton, Tag, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';

interface Props {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeFormatter: (v: number) => string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const AnnotationTooltip2 = ({
  annoVals,
  annoIdx,
  timeFormatter,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: Props) => {
  const styles = useStyles2(getStyles);

  let time = timeFormatter(annoVals.time[annoIdx]);
  let text = annoVals.text[annoIdx];

  if (annoVals.isRegion[annoIdx]) {
    time += ' - ' + timeFormatter(annoVals.timeEnd[annoIdx]);
  }

  let avatar;
  if (annoVals.login?.[annoIdx] && annoVals.avatarUrl?.[annoIdx]) {
    avatar = <img className={styles.avatar} alt="Annotation avatar" src={annoVals.avatarUrl[annoIdx]} />;
  }

  let state: React.ReactNode | null = null;
  let alertText = '';

  if (annoVals.alertId?.[annoIdx] !== undefined && annoVals.newState?.[annoIdx]) {
    const stateModel = alertDef.getStateDisplayModel(annoVals.newState[annoIdx]);
    state = (
      <div className={styles.alertState}>
        <i className={stateModel.stateClass}>{stateModel.text}</i>
      </div>
    );

    // alertText = alertDef.getAlertAnnotationInfo(annotation); // @TODO ??
  } else if (annoVals.title?.[annoIdx]) {
    text = annoVals.title[annoIdx] + '<br />' + (typeof text === 'string' ? text : '');
  }

  return (
    <>
      <div className={styles.header}>
        <HorizontalGroup justify={'space-between'} align={'center'} spacing={'md'}>
          <div className={styles.meta}>
            <span>
              {avatar}
              {state}
            </span>
            {time}
          </div>
          {(canEdit || canDelete) && (
            <div className={styles.editControls}>
              {canEdit && <IconButton name={'pen'} size={'sm'} onClick={onEdit} tooltip="Edit" />}
              {canDelete && <IconButton name={'trash-alt'} size={'sm'} onClick={onDelete} tooltip="Delete" />}
            </div>
          )}
        </HorizontalGroup>
      </div>

      <div className={styles.body}>
        {text && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
        {alertText}
        <>
          <HorizontalGroup spacing="xs" wrap>
            {annoVals.tags[annoIdx]?.map((t: string, i: number) => <Tag name={t} key={`${t}-${i}`} />)}
          </HorizontalGroup>
        </>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
  }),
  meta: css({
    display: 'flex',
    justifyContent: 'space-between',
  }),
  editControls: css({
    display: 'flex',
    alignItems: 'center',
    '> :last-child': {
      marginLeft: 0,
    },
  }),
  body: css({
    padding: theme.spacing(1),
    a: {
      color: theme.colors.text.link,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
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
