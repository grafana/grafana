import React from 'react';
import { HorizontalGroup, IconButton, Tag, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, textUtil } from '@grafana/data';
import alertDef from 'app/features/alerting/state/alertDef';
import { css } from '@emotion/css';

interface AnnotationTooltipProps {
  annotation: AnnotationsDataFrameViewDTO;
  timeFormatter: (v: number) => string;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const AnnotationTooltip: React.FC<AnnotationTooltipProps> = ({
  annotation,
  timeFormatter,
  editable,
  onEdit,
  onDelete,
}) => {
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
    avatar = <img className={styles.avatar} src={annotation.avatarUrl} />;
  }

  if (annotation.alertId) {
    const stateModel = alertDef.getStateDisplayModel(annotation.newState!);
    state = (
      <div className={styles.alertState}>
        <i className={stateModel.stateClass}>{stateModel.text}</i>
      </div>
    );

    alertText = alertDef.getAlertAnnotationInfo(annotation);
  } else if (annotation.title) {
    text = annotation.title + '<br />' + (typeof text === 'string' ? text : '');
  }

  if (editable) {
    editControls = (
      <div className={styles.editControls}>
        <IconButton name={'pen'} size={'sm'} onClick={onEdit} />
        <IconButton name={'trash-alt'} size={'sm'} onClick={onDelete} />
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
      border-radius: 50%;
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
    `,
  };
};
