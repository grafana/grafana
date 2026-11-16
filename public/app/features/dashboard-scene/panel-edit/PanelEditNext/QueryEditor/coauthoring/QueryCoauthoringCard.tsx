import { t } from '@grafana/i18n';
import { Badge, Button, Stack } from '@grafana/ui';

import {
  isQueryCoauthoringV2Active,
  canEnterCoauthoring,
  requestCoauthoringEntry,
  requestCoauthoringResume,
} from './queryCoauthoringApi';
import { useCoauthoringSurface, useCoauthoringCardHealth } from './useCoauthoringSurface';

export function QueryCoauthoringCard({ refId }: { refId: string }) {
  const surface = useCoauthoringSurface();
  const health = useCoauthoringCardHealth(refId);
  if (!surface || !isQueryCoauthoringV2Active()) {
    return null;
  }
  const target = { ...surface.target, refId };
  const proposed = surface.state?.proposal
    ?.find((option) => option.id === surface.state?.previewedOption)
    ?.diffs.some((diff) => diff.refId === refId);
  return (
    <span>
      <Stack gap={0.5}>
        {proposed && <Badge color="blue" text={t('query-coauthoring-v2.proposed', 'Proposed')} />}
        {health.error && <Badge color="red" text={t('query-coauthoring-v2.error', 'Error')} />}
        {health.noData && <Badge color="orange" text={t('query-coauthoring-v2.no-data', 'No data')} />}
        {surface.focus === refId && surface.session ? (
          <Button
            size="sm"
            variant="secondary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              requestCoauthoringResume();
            }}
          >
            {t('query-coauthoring-v2.resume', 'Resume')}
          </Button>
        ) : (
          canEnterCoauthoring(target).ok && (
            <Button
              size="sm"
              variant="secondary"
              icon="ai"
              aria-label={t('query-coauthoring-v2.edit-query', 'Explain or modify query {{refId}}', { refId })}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                requestCoauthoringEntry(
                  { target, ranges: [], intent: 'explain_or_modify', health: surface.pane.getCoauthoringHealth() },
                  'query_button'
                );
              }}
            />
          )
        )}
      </Stack>
    </span>
  );
}
