import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type AnnotationEvent, type DateTimeInput, type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { RenderUserContentAsHTML, TagList, Tooltip, useStyles2 } from '@grafana/ui';

import { type Options } from './panelcfg.gen';

interface Props extends Pick<PanelProps<Options>, 'options'> {
  annotation: AnnotationEvent;
  formatDate: (date: DateTimeInput, format?: string) => string;
  onClick: (annotation: AnnotationEvent) => void;
  onAvatarClick: (annotation: AnnotationEvent) => void;
  onTagClick: (tag: string, remove?: boolean) => void;
}

export const AnnotationListItem = ({ options, annotation, formatDate, onClick, onAvatarClick, onTagClick }: Props) => {
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
    // Plain-div row rather than <Card>: Card's grid layout puts Description on its
    // own row and makes Heading span across columns, which the panel's single-row
    // layout can't override cleanly. Visual styling kept close to a Card.
    <div
      role="button"
      tabIndex={0}
      className={styles.row}
      onClick={onItemClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick();
        }
      }}
    >
      <RenderUserContentAsHTML
        className={styles.heading}
        onClick={(e) => {
          e.stopPropagation();
        }}
        content={text}
      />
      {showTimeStamp && (
        <div className={styles.timestamp}>
          <TimeStamp formatDate={formatDate} time={time!} />
          {showTimeStampEnd && (
            <>
              <span className={styles.time}>-</span>
              <TimeStamp formatDate={formatDate} time={timeEnd!} />{' '}
            </>
          )}
        </div>
      )}
      {showAvatar && (
        <div className={styles.meta}>
          <Avatar email={email} login={login!} avatarUrl={avatarUrl} onClick={onLoginClick} />
        </div>
      )}
      {showTags && tags && (
        <div className={styles.tagList}>
          <TagList tags={tags} onClick={(tag) => onTagClick(tag, false)} />
        </div>
      )}
    </div>
  );
};

interface AvatarProps {
  login: string;
  onClick: () => void;
  avatarUrl?: string;
  email?: string;
}

const Avatar = ({ onClick, avatarUrl, login, email }: AvatarProps) => {
  const styles = useStyles2(getStyles);
  const onAvatarClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  const tooltipContent = (
    <span>
      <Trans i18nKey="annolist.annotation-list-item.tooltip-created-by">
        Created by:
        <br /> {{ email }}
      </Trans>
    </span>
  );

  return (
    <Tooltip content={tooltipContent} theme="info" placement="top">
      <button onClick={onAvatarClick} className={styles.avatar}>
        <img src={avatarUrl} alt="avatar icon" />
      </button>
    </Tooltip>
  );
};

interface TimeStampProps {
  time: number;
  formatDate: (date: DateTimeInput, format?: string) => string;
}

const TimeStamp = ({ time, formatDate }: TimeStampProps) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.time}>
      <span>{formatDate(time)}</span>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, max-content) 1fr auto auto',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      margin: theme.spacing(0.5),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    heading: css({
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.fontWeightMedium,
      a: {
        color: theme.colors.text.link,
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    }),
    meta: css({
      margin: 0,
      justifySelf: 'end',
    }),
    timestamp: css({
      margin: 0,
    }),
    tagList: css({
      justifySelf: 'end',
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
        borderRadius: theme.shape.radius.circle,
        width: theme.spacing(2),
        height: theme.spacing(2),
      },
    }),
  };
}
