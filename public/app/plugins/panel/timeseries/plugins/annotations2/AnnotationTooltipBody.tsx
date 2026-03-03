import { css } from '@emotion/css';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { Stack, Tag, useStyles2 } from '@grafana/ui';

export function AnnotationTooltipBody({
  text,
  title,
  alertText,
  tags,
}: {
  title?: string;
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
          {tags?.length
            ? tags.map?.((t, i) => <Tag data-testid={'annotation-tag'} name={t} key={`${t}-${i}`} />)
            : null}
        </Stack>
      </div>
    </div>
  );
}

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
