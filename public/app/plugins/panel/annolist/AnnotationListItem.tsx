import React, { FC, MouseEvent } from 'react';
import { css, cx } from '@emotion/css';
import { AnnotationEvent, DateTimeInput, GrafanaTheme, PanelProps } from '@grafana/data';
import { styleMixins, Tooltip, useStyles } from '@grafana/ui';
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
  const styles = useStyles(getStyles);
  const { showUser, showTags, showTime } = options;
  const { text, login, email, avatarUrl, tags, time } = annotation;
  const onItemClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick(annotation);
  };
  const onLoginClick = () => {
    onAvatarClick(annotation);
  };
  const showAvatar = login && showUser;
  const showTimeStamp = time && showTime;

  return (
    <div>
      <span className={cx(styles.item, styles.link, styles.pointer)} onClick={onItemClick}>
        <div className={styles.title}>
          <span>{text}</span>
          {showTimeStamp ? <TimeStamp formatDate={formatDate} time={time!} /> : null}
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
  const styles = useStyles(getStyles);
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
  const styles = useStyles(getStyles);

  return (
    <span className={styles.time}>
      <span>{formatDate(time)}</span>
    </span>
  );
};

function getStyles(theme: GrafanaTheme) {
  return {
    pointer: css`
      cursor: pointer;
    `,
    item: css`
      margin: ${theme.spacing.xs};
      padding: ${theme.spacing.sm};
      ${styleMixins.listItem(theme)}// display: flex;
    `,
    title: css`
      flex-basis: 80%;
    `,
    link: css`
      display: flex;

      .fa {
        padding-top: ${theme.spacing.xs};
      }

      .fa-star {
        color: ${theme.palette.orange};
      }
    `,
    login: css`
      align-self: center;
      flex: auto;
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.sm};
    `,
    time: css`
      margin-left: ${theme.spacing.sm};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
    `,
    avatar: css`
      padding: ${theme.spacing.xs};
      img {
        border-radius: 50%;
        width: ${theme.spacing.md};
        height: ${theme.spacing.md};
      }
    `,
  };
}
