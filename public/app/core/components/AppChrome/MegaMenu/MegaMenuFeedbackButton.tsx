import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface Props {
  onClick: () => void;
}

/**
 * Footer affordance for the customisable mega menu. Its onClick publishes the feedback event that
 * triggers the "Customisable navigation feedback" survey; shown wherever the customise feature is
 * available so people who have set up their nav can tell us how it went.
 */
export function MegaMenuFeedbackButton({ onClick }: Props) {
  return (
    <Button variant="secondary" size="sm" icon="comment-alt-message" onClick={onClick}>
      {t('navigation.megamenu.feedback', 'Give feedback')}
    </Button>
  );
}
