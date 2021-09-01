import React, { FC, MouseEvent } from 'react';
import { css, cx } from '@emotion/css';
import { AnnotationEvent, DateTimeInput, GrafanaTheme2, PanelProps } from '@grafana/data';
import { styleMixins, Tooltip, useStyles2 } from '@grafana/ui';
import { AnnoOptions } from './types';
import { AnnotationListItemTags } from './AnnotationListItemTags';

interface Props extends Pick<PanelProps<AnnoOptions>, 'options'> {
  annotation: AnnotationEvent;
  formatDate: (date: DateTimeInput, format?: string) => string;
  onClick: (annotation: AnnotationEvent) => void;
  onAvatarClick: (annotation: AnnotationEvent) => void;
  onTagClick: (tag: string, remove?: boolean) => void;
}

export const AnnotationListItem: FC<Props> = ({
  options,
  annotation,
  formatDate,
  onClick,
  onAvatarClick,
  onTagClick,
}) => {
  const styles = useStyles2(getStyles);
  const { showUser, showTags, showTime } = options;
  const { text, login, email, avatarUrl, tags, time, timeEnd } = annotation;
  const onItemClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick(annotation);
  };
  const onLoginClick = () => {
    onAvatarClick(annotation);
  };
  const showAvatar = login && showUser;
  const showTimeStamp = time && showTime;
  const showTimeStampEnd = timeEnd && timeEnd !== time && showTime;

  return (
    <div>
      <span className={cx(styles.item, styles.link, styles.pointer)} onClick={onItemClick}>
        <div className={styles.title}>
          <span>{text}</span>
          {showTimeStamp ? <TimeStamp formatDate={formatDate} time={time!} /> : null}
          {showTimeStampEnd ? <span className={styles.time}>-</span> : null}
          {showTimeStampEnd ? <TimeStamp formatDate={formatDate} time={timeEnd!} /> : null}
        </div>
        <div className={styles.login}>
          {showAvatar ? <Avatar email={email} login={login!} avatarUrl={avatarUrl} onClick={onLoginClick} /> : null}
          {showTags ? <AnnotationListItemTags tags={tags} remove={false} onClick={onTagClick} /> : null}
        </div>
      </span>
    </div>
  );
};

interface AvatarProps {
  login: string;
  onClick: () => void;
  avatarUrl?: string;
  email?: string;
}

const Avatar: FC<AvatarProps> = ({ onClick, avatarUrl, login, email }) => {
  const styles = useStyles2(getStyles);
  const onAvatarClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  const tooltipContent = (
    <span>
      Created by:
      <br /> {email}
    </span>
  );

  return (
    <div>
      <Tooltip content={tooltipContent} theme="info" placement="top">
        <span onClick={onAvatarClick} className={styles.avatar}>
          <img src={avatarUrl} alt="avatar icon" />
        </span>
      </Tooltip>
    </div>
  );
};

interface TimeStampProps {
  time: number;
  formatDate: (date: DateTimeInput, format?: string) => string;
}

const TimeStamp: FC<TimeStampProps> = ({ time, formatDate }) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.time}>
      <span>{formatDate(time)}</span>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    pointer: css`
      cursor: pointer;
    `,
    item: css`
      margin: ${theme.spacing(0.5)};
      padding: ${theme.spacing(1)};
      ${styleMixins.listItem(theme)}// display: flex;
    `,
    title: css`
      flex-basis: 80%;
    `,
    link: css`
      display: flex;

      .fa {
        padding-top: ${theme.spacing(0.5)};
      }

      .fa-star {
        color: ${theme.v1.palette.orange};
      }
    `,
    login: css`
      align-self: center;
      flex: auto;
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    time: css`
      margin-left: ${theme.spacing(1)};
      margin-right: ${theme.spacing(1)}
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    avatar: css`
      padding: ${theme.spacing(0.5)};
      img {
        border-radius: 50%;
        width: ${theme.spacing(2)};
        height: ${theme.spacing(2)};
      }
    `,
  };
}
