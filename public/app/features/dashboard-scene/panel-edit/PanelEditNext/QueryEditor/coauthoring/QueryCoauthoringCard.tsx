import { t } from '@grafana/i18n';
import { Badge, Button, Stack } from '@grafana/ui';

import {
  isQueryCoauthoringSurfaceActive,
  canEnterCoauthoring,
  requestCoauthoringEntry,
  requestCoauthoringResume,
} from './queryCoauthoringApi';
import { useCoauthoringSurface, useCoauthoringCardHealth } from './useCoauthoringSurface';

export function QueryCoauthoringCard({ refId, part = 'all' }: { refId: string; part?: 'all' | 'badges' | 'actions' }) {
  const surface = useCoauthoringSurface();
  const health = useCoauthoringCardHealth(refId);
  if (!surface || !isQueryCoauthoringSurfaceActive()) {
    return null;
  }
  const target = { ...surface.target, refId };
  const proposed = surface.state?.proposal
    ?.find((option) => option.id === surface.state?.previewedOption)
    ?.diffs.some((diff) => diff.refId === refId);
  return (
    <span>
      <Stack gap={0.5}>
        {part !== 'actions' && proposed && (
          <Badge color="blue" text={t('query-coauthoring.surface.proposed', 'Proposed')} />
        )}
        {part !== 'actions' && health.error && (
          <Badge color="red" text={t('query-coauthoring.surface.error', 'Error')} />
        )}
        {part !== 'actions' && health.noData && (
          <Badge color="orange" text={t('query-coauthoring.surface.no-data', 'No data')} />
        )}
        {part !== 'badges' &&
          ((surface.focus === refId || proposed) && surface.session && !surface.session.signal.aborted ? (
            <Button
              size="sm"
              variant="secondary"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                requestCoauthoringResume(refId);
              }}
            >
              {t('query-coauthoring.surface.resume', 'Resume')}
            </Button>
          ) : (
            canEnterCoauthoring(target).ok && (
              <Button
                size="sm"
                variant="secondary"
                icon="ai"
                aria-label={t('query-coauthoring.surface.edit-query', 'Explain or modify query {{refId}}', { refId })}
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
          ))}
      </Stack>
    </span>
  );
}
