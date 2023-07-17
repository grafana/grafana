import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { HorizontalGroup, IconButton, Tag, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';

import { AnnotationsDataFrameViewDTO } from '../types';

interface AnnotationTooltipProps {
  annotation: AnnotationsDataFrameViewDTO;
  timeFormatter: (v: number) => string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const AnnotationTooltip = ({
  annotation,
  timeFormatter,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: AnnotationTooltipProps) => {
  const styles = useStyles2(getStyles);
  const time = timeFormatter(annotation.time);
  const timeEnd = timeFormatter(annotation.timeEnd);
  let text = annotation.text;
  const tags = annotation.tags;
  let alertText = '';
  let avatar;
  let editControls;
  let state: React.ReactNode | null = null;

  const ts = <span className={styles.time}>{Boolean(annotation.isRegion) ? `${time} - ${timeEnd}` : time}</span>;

  if (annotation.login && annotation.avatarUrl) {
    avatar = <img className={styles.avatar} alt="Annotation avatar" src={annotation.avatarUrl} />;
  }

  if (annotation.alertId !== undefined && annotation.newState) {
    const stateModel = alertDef.getStateDisplayModel(annotation.newState);
    state = (
      <div className={styles.alertState}>
        <i className={stateModel.stateClass}>{stateModel.text}</i>
      </div>
    );

    alertText = alertDef.getAlertAnnotationInfo(annotation);
  } else if (annotation.title) {
    text = annotation.title + '<br />' + (typeof text === 'string' ? text : '');
  }

  if (canEdit || canDelete) {
    editControls = (
      <div className={styles.editControls}>
        {canEdit && <IconButton name={'pen'} size={'sm'} onClick={onEdit} tooltip="Edit" />}
        {canDelete && <IconButton name={'trash-alt'} size={'sm'} onClick={onDelete} tooltip="Delete" />}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <HorizontalGroup justify={'space-between'} align={'center'} spacing={'md'}>
          <div className={styles.meta}>
            <span>
              {avatar}
              {state}
            </span>
            {ts}
          </div>
          {editControls}
        </HorizontalGroup>
      </div>

      <div className={styles.body}>
        {text && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
        {alertText}
        <>
          <HorizontalGroup spacing="xs" wrap>
            {tags?.map((t, i) => (
              <Tag name={t} key={`${t}-${i}`} />
            ))}
          </HorizontalGroup>
        </>
      </div>
    </div>
  );
};

AnnotationTooltip.displayName = 'AnnotationTooltip';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      max-width: 400px;
    `,
    commentWrapper: css`
      margin-top: 10px;
      border-top: 2px solid #2d2b34;
      height: 30vh;
      overflow-y: scroll;
      padding: 0 3px;
    `,
    header: css`
      padding: ${theme.spacing(0.5, 1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
    `,
    meta: css`
      display: flex;
      justify-content: space-between;
    `,
    editControls: css`
      display: flex;
      align-items: center;
      > :last-child {
        margin-right: 0;
      }
    `,
    avatar: css`
      border-radius: ${theme.shape.radius.circle};
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing(1)};
    `,
    alertState: css`
      padding-right: ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    time: css`
      color: ${theme.colors.text.secondary};
      font-weight: normal;
      display: inline-block;
      position: relative;
      top: 1px;
    `,
    body: css`
      padding: ${theme.spacing(1)};

      a {
        color: ${theme.colors.text.link};
        &:hover {
          text-decoration: underline;
        }
      }
    `,
  };
};
