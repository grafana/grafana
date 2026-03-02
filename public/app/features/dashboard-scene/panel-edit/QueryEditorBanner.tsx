import { css } from '@emotion/css';
import { useSessionStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, IconButton, InlineSwitch, TextLink, useStyles2 } from '@grafana/ui';

import {
  QUERY_EDITOR_BANNER_COLORS,
  QUERY_EDITOR_BANNER_DISMISSED_KEY,
  QUERY_EDITOR_BANNER_FEEDBACK_URL,
} from './PanelEditNext/constants';

interface Props {
  useQueryExperienceNext: boolean;
  onToggle: () => void;
}

export function QueryEditorBanner({ useQueryExperienceNext, onToggle }: Props) {
  const styles = useStyles2(getStyles);

  const [dismissed, setDismissed] = useSessionStorage(QUERY_EDITOR_BANNER_DISMISSED_KEY, false);

  if (!config.featureToggles.queryEditorNext || dismissed) {
    return null;
  }

  return (
    <div className={styles.banner}>
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
          {useQueryExperienceNext && (
            <>
              {' '}
              <TextLink href={QUERY_EDITOR_BANNER_FEEDBACK_URL} external inline variant="body">
                {t('dashboard-scene.query-editor-banner.learn-more', 'Learn more')}
              </TextLink>
            </>
          )}
        </span>
      </div>
      <div className={styles.right}>
        <a
          href={QUERY_EDITOR_BANNER_FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionLink}
        >
          {useQueryExperienceNext ? (
            <>
              <Icon name="comment-alt" size="sm" />
              {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
            </>
          ) : (
            <>
              {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
              <Icon name="external-link-alt" size="sm" style={{ opacity: 0.8 }} />
            </>
          )}
        </a>
        {useQueryExperienceNext ? (
          <button className={styles.actionLink} onClick={onToggle}>
            <Icon name="history" size="sm" />
            {t('dashboard-scene.query-editor-banner.go-back', 'Go back to classic')}
          </button>
        ) : (
          <InlineSwitch
            label={t('dashboard-scene.query-editor-banner.new-editor', 'New editor')}
            showLabel={true}
            id="query-editor-version-banner"
            value={useQueryExperienceNext}
            onClick={onToggle}
            aria-label={t('dashboard-scene.query-editor-banner.toggle-aria', 'Toggle between query editor v1 and v2')}
          />
        )}
        <IconButton
          name="times"
          size="md"
          tooltip={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
          onClick={() => setDismissed(true)}
          className={styles.closeButton}
          aria-label={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
        />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    banner: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 2),
      height: theme.spacing(5),
      backgroundColor: QUERY_EDITOR_BANNER_COLORS.background,
      border: `1px solid ${QUERY_EDITOR_BANNER_COLORS.border}`,
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
      backgroundColor: QUERY_EDITOR_BANNER_COLORS.iconBackground,
      flexShrink: 0,
    }),
    accentIcon: css({
      color: QUERY_EDITOR_BANNER_COLORS.accent,
    }),
    title: css({
      color: QUERY_EDITOR_BANNER_COLORS.accent,
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
    closeButton: css({
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
