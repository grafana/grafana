import { Combobox, type ComboboxOption } from '@grafana/ui';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RecordingSplitMode, parseRecordingSplitMode } from '../hooks/useK8sFolderRules';

const OPTIONS: Array<ComboboxOption<RecordingSplitMode>> = [
  { value: 'header-tabs', label: 'Tabs in folder header' },
  { value: 'nested-tabs', label: 'Tabs inside folder' },
  { value: 'inline-divider', label: 'Inline divider' },
  { value: 'mixed-badged', label: 'Mixed list, recording dimmed' },
  { value: 'folder-chip', label: 'Chip at folder bottom' },
  { value: 'tabbed', label: 'Top-level tabs' },
];

/**
 * POC-only control. Switches the `recordingSplitMode` URL param that
 * {@link K8sPaginatedGrafanaLoader} reads to render one of several experimental
 * layouts for mixing alert + recording rules in a folder.
 */
export function RecordingSplitModeSelector() {
  const [params, updateParams] = useURLSearchParams();
  const current = parseRecordingSplitMode(params.get('recordingSplitMode'));

  return (
    <Combobox<RecordingSplitMode>
      options={OPTIONS}
      value={current}
      width={28}
      onChange={(option) => updateParams({ recordingSplitMode: option.value })}
    />
  );
}
