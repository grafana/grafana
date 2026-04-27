import { css, cx } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Button, IconButton } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

import { startIntercomSurvey, trackBannerDismiss, trackFeedbackClick } from './PanelEditNext/tracking';

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
        <Icon name="flask" size="md" className={styles.accentIcon} />
        <span className={styles.title}>
          {useQueryExperienceNext
            ? t('dashboard-scene.query-editor-banner.downgrade-title', 'New query editor')
            : t('dashboard-scene.query-editor-banner.upgrade-title', 'New editor available')}
        </span>
        <span className={styles.description}>
          {useQueryExperienceNext
            ? t(
                'dashboard-scene.query-editor-banner.description-new',
                'Welcome to the improved query editing experience.'
              )
            : t(
                'dashboard-scene.query-editor-banner.description-classic',
                'Try the improved query editing experience.'
              )}
        </span>
      </div>
      <div className={styles.right}>
        {useQueryExperienceNext && (
          <Button
            variant="primary"
            fill="text"
            size="sm"
            icon="comment-alt-message"
            onClick={() => {
              trackFeedbackClick();
              startIntercomSurvey();
            }}
          >
            {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
          </Button>
        )}
        {useQueryExperienceNext ? (
          <Button
            variant="secondary"
            fill="text"
            size="sm"
            icon="arrow-left"
            onClick={() => {
              startIntercomSurvey();
              onToggle();
            }}
          >
            {t('dashboard-scene.query-editor-banner.go-back', 'Back to classic')}
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
          onClick={() => {
            trackBannerDismiss();
            onDismiss();
          }}
          className={styles.closeButton}
          aria-label={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 2),
    height: theme.spacing(5),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    flexShrink: 0,
  }),
  left: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  }),
  accentIcon: css({
    color: theme.colors.warning.text,
  }),
  title: css({
    color: theme.colors.warning.text,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),
  description: css({
    color: theme.colors.text.primary,
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
});
