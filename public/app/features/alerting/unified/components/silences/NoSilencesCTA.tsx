import { Trans, t } from '@grafana/i18n';
import { CallToActionCard, EmptyState, LinkButton, Stack, Text } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { trackSilencePrefillPartial } from '../../Analytics';
import { isGranted, isNotSupported } from '../../hooks/abilities/abilityUtils';
import { useSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';
import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';

import { createSilencePrefillLink } from './utils';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash = ({ alertManagerSourceName }: Props) => {
  const createAbility = useSilenceAbility({ action: SilenceAction.Create });
  const [queryParams] = useQueryParams();
  const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
  const silencePrefill = createSilencePrefillLink(
    alertManagerSourceName,
    parsePromQLStyleMatcherLooseSafe(queryString ?? '')
  );

  const canPrefillSilence = silencePrefill.status === 'ready';
  const handleCreateSilenceClick = () => {
    if (silencePrefill.status === 'ready' && silencePrefill.prefilledMatchers < silencePrefill.totalMatchers) {
      trackSilencePrefillPartial();
    }
  };

  // Show the button for every cause except NOT_SUPPORTED (wrong AM type).
  // While the AM is still resolving (LOADING), the button is rendered disabled
  // rather than hidden so the empty state doesn't flash a different layout.
  if (!isNotSupported(createAbility)) {
    return (
      <EmptyState
        variant="call-to-action"
        button={
          <Stack direction="column" alignItems="center" gap={1}>
            {!canPrefillSilence && (
              <Text color="secondary">
                {t(
                  'alerting.silences.prefill-cannot-fit',
                  'Cannot open a new silence because the destination URL exceeds 2,000 bytes.'
                )}
              </Text>
            )}
            <LinkButton
              href={silencePrefill.status === 'ready' ? silencePrefill.href : undefined}
              onClick={handleCreateSilenceClick}
              icon="bell-slash"
              size="lg"
              disabled={!canPrefillSilence || !isGranted(createAbility)}
              role={canPrefillSilence ? undefined : 'link'}
            >
              <Trans i18nKey="silences.empty-state.button-title">Create silence</Trans>
            </LinkButton>
          </Stack>
        }
        message={t('silences.empty-state.title', "You haven't created any silences yet")}
      />
    );
  }
  return <CallToActionCard callToActionElement={<div />} message="No silences found." />;
};
