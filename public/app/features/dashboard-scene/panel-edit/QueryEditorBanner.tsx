import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, IconButton, LinkButton, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_BANNER_FEEDBACK_URL, getQueryEditorBannerColors } from './PanelEditNext/constants';

interface Props {
  useQueryExperienceNext: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  className?: string;
}

export function QueryEditorBanner({ useQueryExperienceNext, onToggle, onDismiss, className }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.banner, className)}>
      <div className={styles.left}>
        <div className={styles.iconCircle}>
          <Icon name={useQueryExperienceNext ? 'rocket' : 'bolt'} size="md" className={styles.accentIcon} />
        </div>
        <span className={styles.title}>
          {useQueryExperienceNext
            ? t('dashboard-scene.query-editor-banner.downgrade-title', 'New query editor!')
            : t('dashboard-scene.query-editor-banner.upgrade-title', 'New editor available!')}
        </span>
        <span className={styles.description}>
          {t('dashboard-scene.query-editor-banner.description', 'Try the improved query editing experience.')}
        </span>
      </div>
      <div className={styles.right}>
        {useQueryExperienceNext && (
          <LinkButton
            variant="primary"
            fill="text"
            size="sm"
            icon="comment-alt"
            href={QUERY_EDITOR_BANNER_FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
          </LinkButton>
        )}
        {useQueryExperienceNext ? (
          <Button variant="secondary" fill="text" size="sm" icon="history" onClick={onToggle}>
            {t('dashboard-scene.query-editor-banner.go-back', 'Go back to classic')}
          </Button>
        ) : (
          <Button variant="primary" fill="text" size="sm" icon="rocket" onClick={onToggle}>
            {t('dashboard-scene.query-editor-banner.try-it', 'Try it out')}
          </Button>
        )}
        <IconButton
          name="times"
          size="md"
          tooltip={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
          onClick={onDismiss}
          className={styles.closeButton}
          aria-label={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
        />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const bannerColors = getQueryEditorBannerColors(theme);

  return {
    banner: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 2),
      height: theme.spacing(5),
      backgroundColor: bannerColors.background,
      border: `1px solid ${bannerColors.border}`,
      borderRadius: theme.shape.radius.default,
      flexShrink: 0,
    }),
    left: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      minWidth: 0,
    }),
    iconCircle: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(3.25),
      height: theme.spacing(3.25),
      borderRadius: theme.shape.radius.circle,
      backgroundColor: bannerColors.iconBackground,
      flexShrink: 0,
    }),
    accentIcon: css({
      color: bannerColors.accent,
    }),
    title: css({
      color: bannerColors.accent,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
    }),
    description: css({
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    right: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexShrink: 0,
      marginLeft: theme.spacing(2), // minimum gap when left content is wide
    }),
    closeButton: css({
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
