import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, TextLink, useStyles2 } from '@grafana/ui';

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
          <TextLink href={QUERY_EDITOR_BANNER_FEEDBACK_URL} external inline icon="comment-alt" variant="bodySmall">
            {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
          </TextLink>
        )}
        {useQueryExperienceNext ? (
          <button className={styles.actionLink} onClick={onToggle}>
            <Icon name="history" size="sm" />
            {t('dashboard-scene.query-editor-banner.go-back', 'Go back to classic')}
          </button>
        ) : (
          <button className={styles.tryItButton} onClick={onToggle}>
            <Icon name="rocket" size="sm" />
            {t('dashboard-scene.query-editor-banner.try-it', 'Try it out')}
          </button>
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
      fontSize: theme.typography.body.fontSize,
      whiteSpace: 'nowrap',
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    right: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      flexShrink: 0,
      marginLeft: theme.spacing(2),
    }),
    actionLink: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },
    }),
    tryItButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: bannerColors.accent,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },
    }),
    closeButton: css({
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
