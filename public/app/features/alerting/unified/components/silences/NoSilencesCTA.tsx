import { Trans, t } from '@grafana/i18n';
import { CallToActionCard, EmptyState, LinkButton } from '@grafana/ui';

import { isGranted, isNotSupported } from '../../hooks/abilities/abilityUtils';
import { useSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash = ({ alertManagerSourceName }: Props) => {
  const createAbility = useSilenceAbility({ action: SilenceAction.Create });

  // Show the button for every cause except NOT_SUPPORTED (wrong AM type).
  // While the AM is still resolving (LOADING), the button is rendered disabled
  // rather than hidden so the empty state doesn't flash a different layout.
  if (!isNotSupported(createAbility)) {
    return (
      <EmptyState
        variant="call-to-action"
        button={
          <LinkButton
            href={makeAMLink('alerting/silence/new', alertManagerSourceName)}
            icon="bell-slash"
            size="lg"
            disabled={!isGranted(createAbility)}
          >
            <Trans i18nKey="silences.empty-state.button-title">Create silence</Trans>
          </LinkButton>
        }
        message={t('silences.empty-state.title', "You haven't created any silences yet")}
      />
    );
  }
  return <CallToActionCard callToActionElement={<div />} message="No silences found." />;
};
