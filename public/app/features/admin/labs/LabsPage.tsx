import { useCallback, useId, useMemo, useState } from 'react';

import {
  FEATURE_TOGGLE_REGISTRY,
  type FeatureToggleRegistryEntry,
  type FeatureToggleStage,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Badge,
  Button,
  Collapse,
  Field,
  InlineFieldRow,
  InlineLabel,
  Input,
  Stack,
  Switch,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';

import {
  clearFeatureToggleLocalOverridesInBrowser,
  readFeatureToggleLocalOverridesFromBrowser,
  writeFeatureToggleLocalOverridesToBrowser,
} from './labsFeatureTogglesStorage';

const STAGE_ORDER: FeatureToggleStage[] = [
  'GA',
  'publicPreview',
  'privatePreview',
  'experimental',
  'deprecated',
  'unknown',
];

const DEFAULT_OPEN_STAGES: Record<FeatureToggleStage, boolean> = {
  GA: true,
  publicPreview: true,
  privatePreview: true,
  experimental: true,
  deprecated: true,
  unknown: true,
};

function stageHeading(stage: FeatureToggleStage): string {
  switch (stage) {
    case 'GA':
      return t('admin.labs.stage-heading-ga', 'General availability');
    case 'publicPreview':
      return t('admin.labs.stage-heading-public-preview', 'Public preview');
    case 'privatePreview':
      return t('admin.labs.stage-heading-private-preview', 'Private preview');
    case 'experimental':
      return t('admin.labs.stage-heading-experimental', 'Experimental');
    case 'deprecated':
      return t('admin.labs.stage-heading-deprecated', 'Deprecated');
    default:
      return t('admin.labs.stage-heading-unknown', 'Unknown stage');
  }
}

function groupEntriesByStage(entries: FeatureToggleRegistryEntry[]): Map<FeatureToggleStage, FeatureToggleRegistryEntry[]> {
  const map = new Map<FeatureToggleStage, FeatureToggleRegistryEntry[]>();
  for (const stage of STAGE_ORDER) {
    map.set(stage, []);
  }
  for (const entry of entries) {
    const stage: FeatureToggleStage = STAGE_ORDER.includes(entry.stage) ? entry.stage : 'unknown';
    map.get(stage)!.push(entry);
  }
  return map;
}

function getToggleEffective(name: string): boolean {
  return Boolean(Reflect.get(config.featureToggles, name));
}

export default function LabsPage() {
  const searchFieldId = useId();
  const isServerAdmin = contextSrv.isGrafanaAdmin;

  const [query, setQuery] = useState('');

  const [openStages, setOpenStages] = useState(() => ({ ...DEFAULT_OPEN_STAGES }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...FEATURE_TOGGLE_REGISTRY];
    if (!q) {
      return list;
    }
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.owner.toLowerCase().includes(q) ||
        e.stage.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => groupEntriesByStage(filtered), [filtered]);

  const toggleFlag = useCallback((name: string, enabled: boolean) => {
    Object.assign(config.featureToggles, { [name]: enabled });
    const prev = readFeatureToggleLocalOverridesFromBrowser();
    writeFeatureToggleLocalOverridesToBrowser({ ...prev, [name]: enabled });
  }, []);

  const onResetAll = () => {
    clearFeatureToggleLocalOverridesInBrowser();
    window.location.reload();
  };

  const onReload = () => {
    window.location.reload();
  };

  const registrySummary = t(
    'admin.labs.registry-count',
    'Showing {{filtered}} of {{total}} registry flags for this Grafana build.',
    {
      filtered: filtered.length,
      total: FEATURE_TOGGLE_REGISTRY.length,
    }
  );

  if (!isServerAdmin) {
    return (
      <Page navId="cfg/labs">
        <Page.Contents>
          <Alert title={t('admin.labs.access-denied-title', 'Access denied')} severity="error">
            <Trans i18nKey="admin.labs.access-denied-body">
              Only Grafana server administrators can open Labs.
            </Trans>
          </Alert>
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="cfg/labs">
      <Page.Contents>
        <p>
          <Trans i18nKey="admin.labs.intro" components={{ code: <code /> }}>
            These toggles correspond to Grafana&apos;s feature registry. Overrides use the same{' '}
            <code>grafana.featureToggles</code> browser entry as Grafana&apos;s frontend bootstrap; they are merged with
            server defaults on reload.
          </Trans>
        </p>
        <Alert title={t('admin.labs.browser-only-title', 'Browser-only overrides')} severity="info">
          <Trans i18nKey="admin.labs.browser-only-body">
            Changes apply only in this browser profile. Reload the page to apply overrides after editing.
          </Trans>
        </Alert>
        <InlineFieldRow>
          <Field label={t('admin.labs.search-label', 'Search flags')} htmlFor={searchFieldId} noMargin>
            <Input
              id={searchFieldId}
              type="search"
              width={48}
              placeholder={t('admin.labs.search-placeholder', 'Name, description, owner, stage…')}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </Field>
          <Stack direction="row" alignItems="center" gap={1}>
            <Button variant="secondary" onClick={onReload}>
              <Trans i18nKey="admin.labs.reload">Reload</Trans>
            </Button>
            <Button variant="destructive" onClick={onResetAll}>
              <Trans i18nKey="admin.labs.reset">Reset all local overrides</Trans>
            </Button>
          </Stack>
        </InlineFieldRow>

        <p>{registrySummary}</p>

        {STAGE_ORDER.map((stage) => {
          const entries = grouped.get(stage) ?? [];
          if (entries.length === 0) {
            return null;
          }

          const label = `${stageHeading(stage)} (${entries.length})`;

          return (
            <Collapse
              key={stage}
              label={label}
              isOpen={openStages[stage]}
              onToggle={() => setOpenStages((prev) => ({ ...prev, [stage]: !prev[stage] }))}
            >
              <Stack direction="column" gap={2}>
                {entries.map((entry) => (
                  <LabsToggleRow key={entry.name} entry={entry} checked={getToggleEffective(entry.name)} onChange={toggleFlag} />
                ))}
              </Stack>
            </Collapse>
          );
        })}
      </Page.Contents>
    </Page>
  );
}

interface LabsToggleRowProps {
  entry: FeatureToggleRegistryEntry;
  checked: boolean;
  onChange: (name: string, enabled: boolean) => void;
}

function LabsToggleRow({ entry, checked, onChange }: LabsToggleRowProps) {
  const switchId = useId();

  return (
    <Field
      htmlFor={switchId}
      label={entry.name}
      noMargin
      description={
        <>
          <div>{entry.description}</div>
          <Stack direction="row" wrap gap={1} alignItems="center">
            {entry.frontendOnly && (
              <Badge text={t('admin.labs.badge-frontend', 'Frontend only')} color="purple" />
            )}
            {entry.requiresRestart && <Badge text={t('admin.labs.badge-restart', 'Requires restart')} color="orange" />}
            {entry.hideFromDocs && (
              <Badge text={t('admin.labs.badge-hidden', 'Hidden from docs')} color="darkgrey" />
            )}
            {entry.requiresDevMode && (
              <Badge text={t('admin.labs.badge-dev-mode', 'Requires dev mode')} color="orange" />
            )}
            <InlineLabel>
              {t('admin.labs.meta-stage', 'Stage')}: {entry.stage}
            </InlineLabel>
            <InlineLabel>
              {t('admin.labs.meta-owner', 'Owner')}: {entry.owner}
            </InlineLabel>
            <InlineLabel>
              {t('admin.labs.meta-default', 'Default')}: {entry.expression}
            </InlineLabel>
          </Stack>
        </>
      }
    >
      <Switch id={switchId} value={checked} onChange={(e) => onChange(entry.name, e.currentTarget.checked)} />
    </Field>
  );
}
