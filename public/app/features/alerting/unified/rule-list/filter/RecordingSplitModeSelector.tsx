import { css } from '@emotion/css';
import { useId } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, useStyles2 } from '@grafana/ui';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RecordingSplitMode, parseRecordingSplitMode } from '../hooks/useK8sFolderRules';

const OPTIONS: Array<ComboboxOption<RecordingSplitMode>> = [
  { value: 'header-tabs', label: 'Tabs in folder header' },
  { value: 'nested-tabs', label: 'Tabs inside folder' },
  { value: 'inline-divider', label: 'Inline divider' },
  { value: 'mixed-badged', label: 'Mixed list, recording dimmed' },
  { value: 'folder-chip', label: 'Chip at folder bottom' },
  { value: 'tabbed', label: 'Top-level tabs' },
  { value: 'search', label: 'Single /search request' },
];

/**
 * POC-only control. Switches the `recordingSplitMode` URL param that
 * {@link K8sPaginatedGrafanaLoader} reads to render one of several experimental
 * layouts for mixing alert + recording rules in a folder.
 */
export function RecordingSplitModeSelector() {
  const [params, updateParams] = useURLSearchParams();
  const current = parseRecordingSplitMode(params.get('recordingSplitMode'));
  const styles = useStyles2(getStyles);
  // Combobox only forwards `aria-labelledby` to the input, so we label it with a
  // visually-hidden element to satisfy the accessible-name requirement.
  const labelId = useId();

  return (
    <>
      <span id={labelId} className={styles.srOnly}>
        {t('alerting.recording-split-mode-selector.aria-label-layout', 'Recording rules layout')}
      </span>
      <Combobox<RecordingSplitMode>
        aria-labelledby={labelId}
        options={OPTIONS}
        value={current}
        width={28}
        onChange={(option) => updateParams({ recordingSplitMode: option.value })}
      />
    </>
  );
}

const getStyles = () => ({
  srOnly: css({
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }),
});
