import { useId, useState } from 'react';

import { t } from '@grafana/i18n';
import { useDataSourceInstanceList } from '@grafana/runtime';
import { Box, Input, MultiCombobox, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import {
  FieldLabelWithTooltip,
  SidebarField,
  ToggleButtonGroup,
  type ToggleOption,
} from '../../rule-list/filter/RulesFilterSidebar';

/**
 * The sidebar shell each page fills with its filters. Every filter applies at once, except text, on blur or Enter.
 * Clearing them all is the search input's Clear button.
 */
export function FilterSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Box width={32} shrink={0} paddingBottom={2}>
      <Stack direction="column" gap={2}>
        {children}
      </Stack>
    </Box>
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

/** One picker per folder, and an empty one that adds a folder. */
export function FolderFilter({ folderUids, onChange }: { folderUids: string[]; onChange: (uids: string[]) => void }) {
  const pick = (index: number, uid: string | undefined) => {
    const next = [...folderUids];
    next.splice(index, 1, ...(uid ? [uid] : []));
    onChange(next);
  };

  return (
    <SidebarField
      label={
        <FieldLabelWithTooltip
          label={t('alerting.gma-rule-list.sidebar.folder', 'Folder')}
          tooltip={t('alerting.gma-rule-list.sidebar.folder-description', 'Rules directly in this folder')}
          tooltipTitle={t('alerting.gma-rule-list.sidebar.folder-help', 'Folder filter help')}
        />
      }
    >
      <Stack direction="column" gap={1}>
        {[...folderUids, undefined].map((uid, index) => (
          <NestedFolderPicker
            // The same folder can be listed twice, and the picker reads its value from props.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            value={uid}
            permission="view"
            clearable
            onChange={(next) => pick(index, next)}
          />
        ))}
      </Stack>
    </SidebarField>
  );
}

/** Query data sources, by UID. */
export function DataSourceFilter({ uids, onChange }: { uids: string[]; onChange: (uids: string[]) => void }) {
  const id = useId();
  const { items, isLoading } = useDataSourceInstanceList({ alerting: true });
  const options = items.map((ds) => ({ label: ds.name, value: ds.uid }));
  // Options, not UIDs, so a UID with no data source behind it still shows and can be removed.
  const value = uids.map((uid) => options.find((option) => option.value === uid) ?? { label: uid, value: uid });

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
