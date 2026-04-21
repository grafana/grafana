import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  src: string | undefined;
}

export function AnnotationAvatar({ src }: Props) {
  const styles = useStyles2(getStyles);
  return (
    src && (
      <img
        className={`${styles.avatar} met-image-avatar-user`}
        alt="Annotation avatar"
        src={textUtil.sanitizeUrl(src)}
      />
    )
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    avatar: css({
      borderRadius: theme.shape.radius.circle,
      width: theme.spacing(4),
      height: theme.spacing(4),
      marginRight: theme.spacing(1),
    }),
  };
};
