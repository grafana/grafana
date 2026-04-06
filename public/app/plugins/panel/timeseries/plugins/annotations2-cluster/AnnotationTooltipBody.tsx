import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { Stack, Tag, useStyles2 } from '@grafana/ui';

export function AnnotationTooltipBody({
  text,
  title,
  alertText,
  tags,
}: {
  title?: string | null;
  text: string;
  alertText: string;
  tags: string[];
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.body}>
      {title && <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(title) }}></div>}
      {text && <div className={styles.text} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
      {alertText}
      <div>
        <Stack gap={0.5} wrap={true}>
          {tags.map((t, i) => (
            <Tag data-testid={'annotation-tag'} name={t} key={`${t}-${i}`} />
          ))}
        </Stack>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    label: 'annotation-body',
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
});
