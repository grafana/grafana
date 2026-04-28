import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Button, Card, EmptyState, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  useCreateThreadMutation,
  useGetResourceVersionQuery,
  useListThreadsQuery,
} from '../api/pulseApi';
import { useResourcePulseStream } from '../hooks/useResourcePulseStream';
import { type PulseThread } from '../types';
import { type BodyToken, tokensToBody } from '../utils/body';
import { type PanelSuggestion } from '../utils/lookups';

import { PulseComposer } from './PulseComposer';
import { PulseThreadView } from './PulseThreadView';

interface Props {
  resourceUID: string;
  panelId?: number;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  onMentionPanel?: (panelId: number) => void;
}

/**
 * PulseDrawerContent is the inside of the Pulse drawer, scoped to a
 * specific dashboard (with optional panel filter). The component is
 * pure: the SceneObject wrapper handles overlay/url-state plumbing.
 *
 * State machine:
 *   list view ──"start"──> compose new thread ──"send"──> thread view
 *   list view ──click thread──> thread view
 *   thread view ──"back"──> list view
 */
export function PulseDrawerContent({
  resourceUID,
  panelId,
  panels,
  currentUserId,
  onMentionPanel,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const [activeThreadUID, setActiveThreadUID] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  // Polling fallback when Live is unavailable. Refetches every 15s; live
  // events will invalidate sooner. RTK dedupes within the cache.
  useGetResourceVersionQuery(
    { resourceKind: 'dashboard', resourceUID },
    { pollingInterval: 15_000, skip: !resourceUID }
  );

  useResourcePulseStream({ resourceKind: 'dashboard', resourceUID, enabled: !!resourceUID });

  const { data, isLoading } = useListThreadsQuery({
    resourceKind: 'dashboard',
    resourceUID,
    panelId,
  });

  const [createThread, createThreadState] = useCreateThreadMutation();

  if (activeThreadUID) {
    const thread = data?.items.find((t) => t.uid === activeThreadUID);
    if (!thread) {
      return (
        <Box padding={2}>
          <Stack direction="column" gap={2}>
            <Text>
              <Trans i18nKey="pulse.drawer.thread-missing">Thread not found.</Trans>
            </Text>
            <Button variant="secondary" onClick={() => setActiveThreadUID(null)}>
              {t('pulse.drawer.back', 'Back to threads')}
            </Button>
          </Stack>
        </Box>
      );
    }
    return (
      <Box padding={2} display="flex" direction="column">
        <PulseThreadView
          thread={thread}
          panels={panels}
          currentUserId={currentUserId}
          onMentionPanel={onMentionPanel}
          onBack={() => setActiveThreadUID(null)}
        />
      </Box>
    );
  }

  if (composing) {
    return (
      <Box padding={2}>
        <Stack direction="column" gap={2}>
          <Text element="h3" weight="medium">
            {panelId
              ? t('pulse.drawer.start-on-panel', 'Start a pulse on panel #{{id}}', { id: panelId })
              : t('pulse.drawer.start-on-dashboard', 'Start a pulse on this dashboard')}
          </Text>
          <PulseComposer
            panels={panels}
            autoFocus
            pending={createThreadState.isLoading}
            onSubmit={(tokens: BodyToken[]) => {
              createThread({
                resourceKind: 'dashboard',
                resourceUID,
                panelId,
                body: tokensToBody(tokens),
              })
                .unwrap()
                .then((res) => {
                  setComposing(false);
                  setActiveThreadUID(res.thread.uid);
                });
            }}
          />
          <Button variant="secondary" onClick={() => setComposing(false)}>
            {t('pulse.drawer.cancel', 'Cancel')}
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        <Stack justifyContent="space-between" alignItems="center">
          <Text element="h3" weight="medium">
            {panelId
              ? t('pulse.drawer.threads-on-panel', 'Pulses on panel #{{id}}', { id: panelId })
              : t('pulse.drawer.threads-on-dashboard', 'Pulses on this dashboard')}
          </Text>
          <Button size="sm" icon="plus" onClick={() => setComposing(true)}>
            {t('pulse.drawer.new-thread', 'Start a pulse')}
          </Button>
        </Stack>
        {isLoading && <LoadingPlaceholder text={t('pulse.drawer.loading', 'Loading pulses…')} />}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            variant="not-found"
            message={t('pulse.drawer.empty-title', 'Nothing to discuss yet')}
            button={
              <Button onClick={() => setComposing(true)} icon="plus">
                {t('pulse.drawer.empty-cta', 'Start the first pulse')}
              </Button>
            }
          >
            <Trans i18nKey="pulse.drawer.empty-body">
              Use Pulse to leave context-aware comments on this dashboard. Your team will be notified.
            </Trans>
          </EmptyState>
        )}
        <div className={styles.list}>
          {data?.items.map((t) => (
            <ThreadCard key={t.uid} thread={t} onClick={() => setActiveThreadUID(t.uid)} />
          ))}
        </div>
      </Stack>
    </Box>
  );
}

interface ThreadCardProps {
  thread: PulseThread;
  onClick: () => void;
}

function ThreadCard({ thread, onClick }: ThreadCardProps): ReactNode {
  return (
    <Card noMargin href={undefined} onClick={onClick}>
      <Card.Heading>
        {thread.title ||
          t('pulse.drawer.thread-default-title', 'Conversation started {{when}}', {
            when: new Date(thread.created).toLocaleString(),
          })}
      </Card.Heading>
      <Card.Description>
        {t('pulse.drawer.thread-meta', '{{count}} pulse · last activity {{when}}', {
          count: thread.pulseCount,
          when: new Date(thread.lastPulseAt).toLocaleString(),
        })}
      </Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
