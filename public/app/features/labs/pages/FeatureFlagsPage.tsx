import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  FilterInput,
  LoadingPlaceholder,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

type ResolvedToggleState = {
  allowEditing?: boolean;
  enabled?: Record<string, boolean>;
  toggles?: ToggleStatus[];
};

type ToggleStatus = {
  name: string;
  description?: string;
  stage?: string;
  enabled: boolean;
  writeable: boolean;
  frontend?: boolean;
  requiresRestart?: boolean;
  requiresDevMode?: boolean;
  warning?: string;
};

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

export function FeatureFlagsPage() {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<ResolvedToggleState>();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error>();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      setState(await getBackendSrv().get<ResolvedToggleState>('/api/admin/feature-toggles'));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const allToggles = [...(state?.toggles ?? [])].sort((a, b) => compare(a.name, b.name));

    if (!normalizedQuery) {
      return allToggles;
    }

    return allToggles.filter((toggle) => {
      return [toggle.name, toggle.description, toggle.stage, toggle.warning]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [query, state?.toggles]);

  return (
    <Page navId="labs/feature-flags">
      <Page.Contents>
        <div className={styles.content}>
          <Stack direction="column" gap={2}>
            <Text element="h1" variant="h1">
              <Trans i18nKey="labs.feature-flags.title">Feature flags</Trans>
            </Text>
            <Text color="secondary">
              <Trans i18nKey="labs.feature-flags.description">
                View Grafana feature toggles, their current state, and any limitations for changing them.
              </Trans>
            </Text>
          </Stack>

          <Alert severity="info" title={t('labs.feature-flags.labs-warning-title', 'Labs features may change')}>
            <Trans i18nKey="labs.feature-flags.labs-warning">
              Feature flags often control unstable or incomplete capabilities. Most flags are configured at startup in
              grafana.ini, environment variables, or an OpenFeature provider, so this page does not change them unless a
              runtime write path is available.
            </Trans>
          </Alert>

          {error && (
            <Alert
              severity="error"
              title={t('labs.feature-flags.load-error-title', 'Could not load feature flags')}
            >
              <Stack direction="column" gap={1}>
                <Text>{error.message}</Text>
                <Button variant="secondary" onClick={load}>
                  <Trans i18nKey="labs.feature-flags.retry">Retry</Trans>
                </Button>
              </Stack>
            </Alert>
          )}

          {isLoading ? (
            <LoadingPlaceholder text={t('labs.feature-flags.loading', 'Loading feature flags...')} />
          ) : (
            !error && (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" wrap="wrap">
                  <FilterInput
                    width={36}
                    value={query}
                    onChange={setQuery}
                    placeholder={t('labs.feature-flags.filter-placeholder', 'Search feature flags')}
                  />
                  <Text color="secondary">
                    <Trans
                      i18nKey="labs.feature-flags.summary"
                      values={{ visible: toggles.length, total: state?.toggles?.length ?? 0 }}
                    >
                      Showing {'{{ visible }}'} of {'{{ total }}'} flags
                    </Trans>
                  </Text>
                </Stack>

                {toggles.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Text variant="h4">
                      <Trans i18nKey="labs.feature-flags.empty-title">No feature flags found</Trans>
                    </Text>
                    <Text color="secondary">
                      <Trans i18nKey="labs.feature-flags.empty-description">
                        Try a different search term or clear the filter.
                      </Trans>
                    </Text>
                  </div>
                ) : (
                  <div
                    className={styles.table}
                    role="table"
                    aria-label={t('labs.feature-flags.table-label', 'Feature flags')}
                  >
                    <div className={styles.headerRow} role="row">
                      <Text variant="bodySmall" weight="medium">
                        <Trans i18nKey="labs.feature-flags.table.feature">Feature</Trans>
                      </Text>
                      <Text variant="bodySmall" weight="medium">
                        <Trans i18nKey="labs.feature-flags.table.state">State</Trans>
                      </Text>
                      <Text variant="bodySmall" weight="medium">
                        <Trans i18nKey="labs.feature-flags.table.limitations">Limitations</Trans>
                      </Text>
                    </div>
                    {toggles.map((toggle) => (
                      <FeatureFlagRow key={toggle.name} toggle={toggle} />
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

function FeatureFlagRow({ toggle }: { toggle: ToggleStatus }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.row} role="row">
      <div className={styles.featureCell} role="cell">
        <Stack direction="column" gap={0.5}>
          <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
            <Text variant="code">{toggle.name}</Text>
            {toggle.stage && <Badge color={stageColor(toggle.stage)} text={toggle.stage} />}
          </Stack>
          {toggle.description ? <Text color="secondary">{toggle.description}</Text> : null}
          {toggle.warning ? <Text color="warning">{toggle.warning}</Text> : null}
        </Stack>
      </div>

      <div role="cell">
        <Badge
          color={toggle.enabled ? 'green' : 'red'}
          text={toggle.enabled ? t('labs.feature-flags.enabled', 'On') : t('labs.feature-flags.disabled', 'Off')}
        />
      </div>

      <div role="cell">
        <Stack direction="row" gap={1} wrap="wrap">
          <Badge
            color={toggle.frontend ? 'blue' : 'purple'}
            text={
              toggle.frontend
                ? t('labs.feature-flags.frontend-only', 'Frontend only')
                : t('labs.feature-flags.server-aware', 'Server')
            }
          />
          {toggle.requiresRestart && (
            <Badge color="orange" text={t('labs.feature-flags.requires-restart', 'Restart required')} />
          )}
          {toggle.requiresDevMode && (
            <Badge color="orange" text={t('labs.feature-flags.requires-dev-mode', 'Dev mode only')} />
          )}
          {!toggle.writeable && <Badge color="darkgrey" text={t('labs.feature-flags.read-only', 'Read-only')} />}
        </Stack>
      </div>
    </div>
  );
}

function stageColor(stage: string): BadgeColor {
  switch (stage) {
    case 'GA':
      return 'green';
    case 'preview':
    case 'privatePreview':
      return 'blue';
    case 'deprecated':
      return 'red';
    case 'experimental':
      return 'orange';
    default:
      return 'darkgrey';
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: theme.spacing(150),
  }),
  emptyState: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(4),
  }),
  table: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  headerRow: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1fr) 120px minmax(260px, 0.75fr)',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
  row: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1fr) 120px minmax(260px, 0.75fr)',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    '&:last-child': {
      borderBottom: 0,
    },
  }),
  featureCell: css({
    minWidth: 0,
  }),
});
