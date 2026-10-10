import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Badge,
  type BadgeColor,
  Box,
  Drawer,
  RadioButtonGroup,
  Stack,
  Tab,
  TabsBar,
  Text,
  useStyles2,
} from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';

import { diffDashboardSpecs, type SpecChange } from './specDiff';

interface Props {
  title: string;
  forkSpec?: unknown;
  /** The original as it was when forked; equal to latestSpec when history no longer has it. */
  baseSpec?: unknown;
  latestSpec?: unknown;
  baseGeneration?: number;
  onClose: () => void;
  onSelectPanel: (panelKey: string) => void;
}

type Against = 'base' | 'latest';

/** Fork vs. its original: a readable change list, plus the raw JSON diff. */
export function CompareDrawer({
  title,
  forkSpec,
  baseSpec,
  latestSpec,
  baseGeneration,
  onClose,
  onSelectPanel,
}: Props) {
  const styles = useStyles2(getStyles);
  const [tab, setTab] = useState<'changes' | 'json'>('changes');
  const [against, setAgainst] = useState<Against>('base');
  const reference = against === 'base' ? baseSpec : latestSpec;
  const changes = useMemo(() => diffDashboardSpecs(reference, forkSpec), [reference, forkSpec]);
  const loading = forkSpec === undefined || reference === undefined;

  return (
    <Drawer
      title={t('dashboard-scene.lifecycle.compare-title', 'Compare with “{{title}}”', { title })}
      onClose={onClose}
      size="md"
      tabs={
        <TabsBar>
          <Tab
            label={t('dashboard-scene.lifecycle.compare-changes', 'Changes')}
            active={tab === 'changes'}
            onChangeTab={() => setTab('changes')}
            counter={loading ? undefined : changes.length}
          />
          <Tab
            label={t('dashboard-scene.lifecycle.compare-json', 'JSON diff')}
            active={tab === 'json'}
            onChangeTab={() => setTab('json')}
          />
        </TabsBar>
      }
    >
      <Stack direction="column" gap={2}>
        {baseSpec !== latestSpec && (
          <RadioButtonGroup<Against>
            size="sm"
            value={against}
            onChange={setAgainst}
            options={[
              {
                value: 'base',
                label:
                  baseGeneration !== undefined
                    ? t('dashboard-scene.lifecycle.compare-base', 'Version {{version}} (when you forked)', {
                        version: baseGeneration,
                      })
                    : t('dashboard-scene.lifecycle.compare-base-unknown', 'When you forked'),
              },
              { value: 'latest', label: t('dashboard-scene.lifecycle.compare-latest', 'Latest version') },
            ]}
          />
        )}
        {loading ? (
          <Text color="secondary">
            <Trans i18nKey="dashboard-scene.lifecycle.compare-loading">Loading changes…</Trans>
          </Text>
        ) : tab === 'changes' ? (
          <ChangeList changes={changes} onSelectPanel={onSelectPanel} />
        ) : (
          <div className={styles.diff}>
            <MonacoDiffEditor
              language="json"
              original={JSON.stringify(reference, null, 2)}
              modified={JSON.stringify(forkSpec, null, 2)}
              height="70vh"
            />
          </div>
        )}
      </Stack>
    </Drawer>
  );
}

function ChangeList({ changes, onSelectPanel }: { changes: SpecChange[]; onSelectPanel: (panelKey: string) => void }) {
  const styles = useStyles2(getStyles);
  if (changes.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="dashboard-scene.lifecycle.compare-empty">This fork has no changes.</Trans>
      </Text>
    );
  }
  return (
    <ul className={styles.list}>
      {changes.map((change, i) => {
        const content = (
          <>
            <Badge text={changeLabel(change)} color={changeColor(change)} />
            <span className={styles.name}>{describeChange(change)}</span>
          </>
        );
        return (
          <li key={i}>
            {change.panelKey ? (
              <button type="button" className={styles.row} onClick={() => onSelectPanel(change.panelKey!)}>
                {content}
              </button>
            ) : (
              <Box display="flex" alignItems="center" gap={1} padding={1}>
                {content}
              </Box>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function changeLabel(change: SpecChange): string {
  if (change.target === 'layout') {
    return t('dashboard-scene.lifecycle.change-layout', 'Layout');
  }
  switch (change.type) {
    case 'added':
      return t('dashboard-scene.lifecycle.change-added', 'Added');
    case 'removed':
      return t('dashboard-scene.lifecycle.change-removed', 'Removed');
    default:
      return t('dashboard-scene.lifecycle.change-edited', 'Edited');
  }
}

function changeColor(change: SpecChange): BadgeColor {
  if (change.target === 'layout' || change.target === 'settings') {
    return 'blue';
  }
  return change.type === 'added' ? 'green' : change.type === 'removed' ? 'red' : 'orange';
}

function describeChange(change: SpecChange): string {
  switch (change.target) {
    case 'panel': {
      const parts = change.parts?.length ? ` · ${change.parts.join(', ')}` : '';
      return t('dashboard-scene.lifecycle.change-panel', 'Panel “{{name}}”', { name: change.name }) + parts;
    }
    case 'variable':
      return t('dashboard-scene.lifecycle.change-variable', 'Variable “{{name}}”', { name: change.name });
    case 'layout':
      return t('dashboard-scene.lifecycle.change-layout-detail', 'Panels moved, resized, or regrouped');
    default:
      return t('dashboard-scene.lifecycle.change-setting', 'Dashboard setting “{{name}}”', { name: change.name });
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.75),
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  name: css({
    minWidth: 0,
    overflowWrap: 'anywhere',
  }),
  diff: css({
    minHeight: 400,
  }),
});
