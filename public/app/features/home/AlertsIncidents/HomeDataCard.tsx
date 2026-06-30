import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack, Text } from '@grafana/ui';

import { HomeSection } from '../HomeSection';

interface HomeDataCardProps {
  title: string;
  // Shown next to the title; hidden while loading.
  titleBadge?: ReactNode;
  // Far-right header content; hidden while loading.
  headerActions?: ReactNode;
  loading?: boolean;
  // Skeleton shown while loading; defaults to 3 rows (the SummaryCard look).
  loadingContent?: ReactNode;
  error?: { title: string; onRetry: () => void };
  isEmpty?: boolean;
  emptyMessage?: string;
  // Hidden while loading or in the error state.
  footer?: ReactNode;
  // Body, shown only when not loading/error/empty.
  children?: ReactNode;
}

/** Canvas card chrome (header, loading/error/empty states, footer) shared by the homepage data cards. */
export function HomeDataCard({
  title,
  titleBadge,
  headerActions,
  loading,
  loadingContent,
  error,
  isEmpty,
  emptyMessage,
  footer,
  children,
}: HomeDataCardProps) {
  return (
    <HomeSection display="flex" direction="column" height="100%">
      <Stack direction="column" gap={2} grow={1} minHeight={0}>
        <Stack direction="column" gap={2} grow={1} minHeight={0}>
          <Stack alignItems="center" justifyContent="space-between">
            <Stack alignItems="center">
              <Text element="h2" variant="h5">
                {title}
              </Text>
              {!loading && titleBadge}
            </Stack>
            {!loading && headerActions}
          </Stack>

          {loading &&
            (loadingContent ?? (
              <Stack direction="column">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} height={20} />
                ))}
              </Stack>
            ))}

          {error && (
            <Alert
              severity="warning"
              title={error.title}
              action={
                <Button onClick={error.onRetry} variant="secondary" size="sm">
                  <Trans i18nKey="home.data-card.retry">Retry</Trans>
                </Button>
              }
            />
          )}

          {!loading && !error && isEmpty && emptyMessage && (
            <Stack direction="column" alignItems="center">
              <Text color="secondary">{emptyMessage}</Text>
            </Stack>
          )}

          {!loading && !error && !isEmpty && children}
        </Stack>

        {!loading && !error && footer && <Stack justifyContent="flex-end">{footer}</Stack>}
      </Stack>
    </HomeSection>
  );
}
