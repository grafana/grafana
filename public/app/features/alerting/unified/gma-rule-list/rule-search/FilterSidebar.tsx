import { useId, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { useDataSourceInstanceList } from '@grafana/runtime';
import { Box, Button, Field, Input, MultiCombobox, RadioButtonList, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

/** The sidebar shell each page fills with its filters. Every filter applies at once, except text, on blur or Enter. */
export function FilterSidebar({
  canClear,
  onClear,
  children,
}: {
  canClear: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box width={32} shrink={0}>
      <Stack direction="column" gap={2}>
        <Stack justifyContent="flex-end">
          <Button size="sm" fill="text" onClick={onClear} disabled={!canClear}>
            <Trans i18nKey="alerting.gma-rule-list.sidebar.clear">Clear filters</Trans>
          </Button>
        </Stack>
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
  options: Array<{ label: string; value: Value }>;
  onChange: (value: Value | undefined) => void;
}) {
  const name = useId();
  return (
    <Field noMargin label={label} useFieldset>
      <RadioButtonList<string>
        name={name}
        value={value ?? ALL}
        options={[{ label: t('alerting.gma-rule-list.sidebar.all', 'All'), value: ALL }, ...options]}
        onChange={(next) => onChange(next === ALL ? undefined : options.find((option) => option.value === next)?.value)}
      />
    </Field>
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
    <Field noMargin label={label} htmlFor={id}>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={apply}
        onKeyDown={(event) => event.key === 'Enter' && apply()}
      />
    </Field>
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
    <Field
      noMargin
      label={t('alerting.gma-rule-list.sidebar.folder', 'Folder')}
      description={t('alerting.gma-rule-list.sidebar.folder-description', 'Rules directly in this folder')}
      useFieldset
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
    </Field>
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
    <Field noMargin label={t('alerting.gma-rule-list.sidebar.datasource', 'Query data source')} htmlFor={id}>
      <MultiCombobox<string>
        id={id}
        loading={isLoading}
        options={options}
        value={value}
        placeholder={t('alerting.gma-rule-list.sidebar.datasource-placeholder', 'Select data sources')}
        onChange={(selected) => onChange(selected.map((option) => option.value))}
      />
    </Field>
  );
}

const ALL = '__all__';
