import { useId } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Box, IconButton, Stack, Text } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { useFolderPath } from '../folder-browsing/folderLookups';

interface MultiValueFilterProps {
  /** Every selected UID, in the order the criteria hold them. */
  values: string[];
  onChange: (values: string[]) => void;
  invalid?: boolean;
}

interface FolderMultiFilterProps extends MultiValueFilterProps {
  /** Id for the picker's own control, so a field label can name it. */
  id?: string;
}

/**
 * Folder filter that shows and edits every selected folder. The picker only ever adds one more
 * folder; each selected folder is listed with its own remove button, so a URL or saved search
 * carrying several folders never hides all but the first.
 */
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

/** Query data source filter with the same list-plus-picker shape as the folder filter. */
export function DataSourceMultiFilter({ values, onChange, invalid }: MultiValueFilterProps) {
  // The picker's default input id would repeat on a page with a second data source picker.
  const pickerId = useId();
  return (
    <Stack direction="column" gap={0.5}>
      {values.map((uid) => (
        <DataSourceValue key={uid} uid={uid} onRemove={() => onChange(values.filter((value) => value !== uid))} />
      ))}
      <DataSourcePicker
        inputId={pickerId}
        current={undefined}
        // Without noDefault, an empty `current` preselects the org default data source instead of
        // showing no selection, which here means "do not filter by data source".
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
          aria-label={t('alerting.gma-rule-list.search.remove-value', 'Remove {{value}}', { value: label })}
          onClick={onRemove}
        />
      </Stack>
    </Box>
  );
}
