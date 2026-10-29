import { useId } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Box, IconButton, Stack, Text } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { useFolderPath } from '../folder-browsing/folderLookups';

interface MultiValueFilterProps {
  values: string[];
  onChange: (values: string[]) => void;
  invalid?: boolean;
}

interface FolderMultiFilterProps extends MultiValueFilterProps {
  id?: string;
}

/** Lists every selected folder with its own remove button; the picker only adds one more. */
export function FolderMultiFilter({ id, values, onChange, invalid }: FolderMultiFilterProps) {
  return (
    <Stack direction="column" gap={0.5}>
      {values.map((uid) => (
        <FolderValue key={uid} uid={uid} onRemove={() => onChange(values.filter((value) => value !== uid))} />
      ))}
      <NestedFolderPicker
        id={id}
        value={undefined}
        invalid={invalid}
        permission="view"
        showRootFolder={false}
        onChange={(uid) => {
          if (uid && !values.includes(uid)) {
            onChange([...values, uid]);
          }
        }}
      />
    </Stack>
  );
}

export function DataSourceMultiFilter({ values, onChange, invalid }: MultiValueFilterProps) {
  // The default input id would repeat with a second data source picker.
  const pickerId = useId();
  return (
    <Stack direction="column" gap={0.5}>
      {values.map((uid) => (
        <DataSourceValue key={uid} uid={uid} onRemove={() => onChange(values.filter((value) => value !== uid))} />
      ))}
      <DataSourcePicker
        inputId={pickerId}
        current={undefined}
        // Without noDefault, an empty `current` preselects the org default data source.
        noDefault
        invalid={invalid}
        onChange={(ds: DataSourceInstanceSettings) => {
          if (!values.includes(ds.uid)) {
            onChange([...values, ds.uid]);
          }
        }}
      />
    </Stack>
  );
}

function FolderValue({ uid, onRemove }: { uid: string; onRemove: () => void }) {
  const path = useFolderPath(uid);
  return <SelectedValue label={path?.at(-1) ?? uid} onRemove={onRemove} />;
}

function DataSourceValue({ uid, onRemove }: { uid: string; onRemove: () => void }) {
  const { settings } = useDataSourceInstanceSettings(uid);
  return <SelectedValue label={settings?.name ?? uid} onRemove={onRemove} />;
}

function SelectedValue({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Box backgroundColor="secondary" borderRadius="default" paddingX={1} paddingY={0.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Text truncate>{label}</Text>
        <IconButton
          name="times"
          size="sm"
          aria-label={t('alerting.gma-rule-list.token-search.remove-value', 'Remove {{value}}', { value: label })}
          onClick={onRemove}
        />
      </Stack>
    </Box>
  );
}
