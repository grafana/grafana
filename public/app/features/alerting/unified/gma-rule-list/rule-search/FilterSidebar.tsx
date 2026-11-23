import { type ReactNode, useId, useState } from 'react';
import { useAsync } from 'react-use';

import { buildRoutingTreeOptions, isDefaultRoutingTreeName, useRoutingTrees } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceList } from '@grafana/runtime';
import { Box, Collapse, Combobox, Divider, Input, MultiCombobox, Stack } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { SidebarField, ToggleButtonGroup, type ToggleOption } from '../../rule-list/filter/RulesFilterSidebar';

import { type HealthValue } from './sharedRuleFilter';

/** The filter sidebar beside the rules, or folded above them on narrow screens so the rules keep the full width. */
export function FilterSidebarLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const isWide = useMediaQueryMinWidth('lg');
  const [isOpen, setIsOpen] = useState(false);

  // The rules keep their place in the tree across layouts, so resizing doesn't remount the list.
  return (
    <Stack direction={isWide ? 'row' : 'column'} gap={1}>
      {isWide ? (
        <Box width={32} shrink={0}>
          {sidebar}
        </Box>
      ) : (
        <Collapse label={t('alerting.gma-rule-list.sidebar.filters', 'Filters')} isOpen={isOpen} onToggle={setIsOpen}>
          {sidebar}
        </Collapse>
      )}
      {isWide && <Divider direction="vertical" spacing={0} />}
      <Box flex={1} minWidth={0}>
        {children}
      </Box>
    </Stack>
  );
}

/** One choice of a few, plus All for no filter. */
export function ChoiceFilter<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value | undefined;
  options: Array<ToggleOption<Value>>;
  onChange: (value: Value | undefined) => void;
}) {
  const labelId = useId();
  return (
    <SidebarField label={label} labelId={labelId}>
      <ToggleButtonGroup<Value | undefined>
        aria-labelledby={labelId}
        value={value}
        options={[{ label: t('alerting.gma-rule-list.sidebar.all', 'All'), value: undefined }, ...options]}
        onChange={onChange}
      />
    </SidebarField>
  );
}

/** A text filter, applied on blur or Enter so each keystroke doesn't add a history entry. */
export function TextFilter({
  label,
  value,
  placeholder,
  onApply,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onApply: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  // The query can change elsewhere, in the search box or through Back.
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  const apply = () => {
    if (draft !== value) {
      onApply(draft);
    }
  };

  return (
    <SidebarField label={label} htmlFor={id}>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={apply}
        onKeyDown={(event) => event.key === 'Enter' && apply()}
      />
    </SidebarField>
  );
}

export function FolderFilter({ folderUids, onChange }: { folderUids: string[]; onChange: (uids: string[]) => void }) {
  const id = useId();
  const { value: titles } = useAsync(() => getFolderTitles(folderUids), [folderUids]);
  const value = folderUids.map((uid) => ({ value: uid, label: titles?.get(uid) ?? uid }));

  return (
    <SidebarField
      htmlFor={id}
      label={t('alerting.gma-rule-list.sidebar.folder', 'Folder')}
      tooltip={t('alerting.gma-rule-list.sidebar.folder-description', 'Rules directly in this folder')}
      tooltipTitle={t('alerting.gma-rule-list.sidebar.folder-help', 'Folder filter help')}
    >
      <MultiCombobox<string>
        id={id}
        options={searchFolders}
        value={value}
        placeholder={t('alerting.gma-rule-list.sidebar.folder-placeholder', 'Select folders')}
        onChange={(selected) => onChange(selected.map((option) => option.value))}
      />
    </SidebarField>
  );
}

export function DataSourceFilter({
  dataSourceUids,
  onChange,
}: {
  dataSourceUids: string[];
  onChange: (dataSourceUids: string[]) => void;
}) {
  const id = useId();
  const { items, isLoading } = useDataSourceInstanceList({ alerting: true });
  const options = items.map((ds) => ({ label: ds.name, value: ds.uid }));
  // Options, not UIDs, so a UID with no data source behind it still shows and can be removed.
  const value = dataSourceUids.map(
    (uid) => options.find((option) => option.value === uid) ?? { label: uid, value: uid }
  );

  return (
    <SidebarField label={t('alerting.gma-rule-list.sidebar.datasource', 'Query data source')} htmlFor={id}>
      <MultiCombobox<string>
        id={id}
        loading={isLoading}
        options={options}
        value={value}
        placeholder={t('alerting.gma-rule-list.sidebar.datasource-placeholder', 'Select data sources')}
        onChange={(selected) => onChange(selected.map((option) => option.value))}
      />
    </SidebarField>
  );
}

export function HealthFilter({
  health,
  onChange,
}: {
  health: HealthValue | undefined;
  onChange: (health: HealthValue | undefined) => void;
}) {
  return (
    <ChoiceFilter
      label={t('alerting.gma-rule-list.sidebar.health', 'Health')}
      value={health}
      onChange={onChange}
      options={[
        { label: t('alerting.gma-rule-list.sidebar.health-ok', 'OK'), value: 'ok' },
        { label: t('alerting.gma-rule-list.sidebar.health-nodata', 'No data'), value: 'nodata' },
        { label: t('alerting.gma-rule-list.sidebar.health-error', 'Error'), value: 'error' },
        { label: t('alerting.gma-rule-list.sidebar.health-unknown', 'Unknown'), value: 'unknown' },
      ]}
    />
  );
}

export function PausedFilter({
  paused,
  onChange,
}: {
  paused: 'true' | undefined;
  onChange: (paused: 'true' | undefined) => void;
}) {
  return (
    <ChoiceFilter
      label={t('alerting.gma-rule-list.sidebar.paused', 'Paused')}
      value={paused}
      onChange={onChange}
      options={[{ label: t('alerting.gma-rule-list.sidebar.paused-true', 'Paused'), value: 'true' }]}
    />
  );
}

export function PluginRulesFilter({ hide, onChange }: { hide: boolean; onChange: (hide: boolean) => void }) {
  const labelId = useId();
  return (
    <SidebarField label={t('alerting.gma-rule-list.sidebar.plugin-rules', 'Plugin rules')} labelId={labelId}>
      <ToggleButtonGroup<boolean>
        aria-labelledby={labelId}
        value={hide}
        onChange={onChange}
        options={[
          { label: t('alerting.gma-rule-list.sidebar.plugin-rules-show', 'Show'), value: false },
          { label: t('alerting.gma-rule-list.sidebar.plugin-rules-hide', 'Hide'), value: true },
        ]}
      />
    </SidebarField>
  );
}

/** Named notification policies only: the search can't match the default policy yet. */
export function PolicyFilter({
  policy,
  disabled,
  onChange,
}: {
  policy: string | undefined;
  disabled: boolean;
  onChange: (policy: string | undefined) => void;
}) {
  const id = useId();
  const { trees, isLoading } = useRoutingTrees();
  const options = buildRoutingTreeOptions(trees).filter((option) => !isDefaultRoutingTreeName(option.value));

  return (
    <SidebarField
      htmlFor={id}
      label={t('alerting.gma-rule-list.sidebar.policy', 'Notification policy')}
      tooltip={t(
        'alerting.gma-rule-list.sidebar.policy-description',
        'Rules routed through it, not straight to a contact point'
      )}
      tooltipTitle={t('alerting.gma-rule-list.sidebar.policy-help', 'Notification policy filter help')}
    >
      <Combobox
        id={id}
        placeholder={t('alerting.gma-rule-list.sidebar.policy-placeholder', 'Select policy')}
        options={options}
        loading={isLoading}
        value={policy}
        isClearable
        disabled={disabled}
        onChange={(option) => onChange(option?.value)}
      />
    </SidebarField>
  );
}

async function searchFolders(query: string) {
  const { view } = await getGrafanaSearcher().search({ query, kind: ['folder'], limit: 100, permission: 'view' });
  // The searcher loads every folder's title once, so parent paths cost no request per folder.
  const locationInfo: Record<string, { name: string }> = view.dataFrame.meta?.custom?.locationInfo ?? {};
  return view.map((folder) => ({
    label: folder.name,
    value: folder.uid,
    description: (folder.location || '')
      .split('/')
      .filter((uid) => uid && uid !== 'general')
      .map((uid) => locationInfo[uid]?.name ?? uid)
      .join(' / '),
  }));
}

async function getFolderTitles(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) {
    return new Map();
  }
  const { view } = await getGrafanaSearcher().search({ uid: uids, kind: ['folder'] });
  return new Map(view.map((folder) => [folder.uid, folder.name]));
}
