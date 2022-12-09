import { css } from '@emotion/css';
import React, { FC, MouseEvent } from 'react';

import { AnnotationEvent, DateTimeInput, GrafanaTheme2, PanelProps } from '@grafana/data';
import { Card, TagList, Tooltip, RenderUserContentAsHTML, useStyles2 } from '@grafana/ui';

import { PanelOptions } from './models.gen';

interface Props extends Pick<PanelProps<PanelOptions>, 'options'> {
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
  const { text = '', login, email, avatarUrl, tags, time, timeEnd } = annotation;
  const onItemClick = () => {
    onClick(annotation);
  };
  const onLoginClick = () => {
    onAvatarClick(annotation);
  };
  const showAvatar = login && showUser;
  const showTimeStamp = time && showTime;
  const showTimeStampEnd = timeEnd && timeEnd !== time && showTime;

  return (
    <Card className={styles.card} onClick={onItemClick}>
      <Card.Heading>
        <RenderUserContentAsHTML
          className={styles.heading}
          onClick={(e) => {
            e.stopPropagation();
          }}
          content={text}
        />
      </Card.Heading>
      {showTimeStamp && (
        <Card.Description className={styles.timestamp}>
          <TimeStamp formatDate={formatDate} time={time!} />
          {showTimeStampEnd && (
            <>
              <span className={styles.time}>-</span>
              <TimeStamp formatDate={formatDate} time={timeEnd!} />{' '}
            </>
          )}
        </Card.Description>
      )}
      {showAvatar && (
        <Card.Meta className={styles.meta}>
          <Avatar email={email} login={login!} avatarUrl={avatarUrl} onClick={onLoginClick} />
        </Card.Meta>
      )}
      {showTags && tags && (
        <Card.Tags>
          <TagList tags={tags} onClick={(tag) => onTagClick(tag, false)} />
        </Card.Tags>
      )}
    </Card>
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
    <Tooltip content={tooltipContent} theme="info" placement="top">
      <button onClick={onAvatarClick} className={styles.avatar} aria-label={`Created by ${email}`}>
        <img src={avatarUrl} alt="avatar icon" />
      </button>
    </Tooltip>
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
    card: css({
      gridTemplateAreas: `"Heading Description Meta Tags"`,
      gridTemplateColumns: 'auto 1fr auto auto',
      padding: theme.spacing(1),
      margin: theme.spacing(0.5),
      width: 'inherit',
    }),
    heading: css({
      a: {
        zIndex: 1,
        position: 'relative',
        color: theme.colors.text.link,
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    }),
    meta: css({
      margin: 0,
      position: 'relative',
      justifyContent: 'end',
    }),
    timestamp: css({
      margin: 0,
      alignSelf: 'center',
    }),
    time: css({
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    avatar: css({
      border: 'none',
      background: 'inherit',
      margin: 0,
      padding: theme.spacing(0.5),
      img: {
        borderRadius: '50%',
        width: theme.spacing(2),
        height: theme.spacing(2),
      },
    }),
  };
}
