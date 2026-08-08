import { css } from '@emotion/css';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

interface Props {
  onSelect: (datasource: DataSourceInstanceSettings) => void;
  onCancel: () => void;
}

/**
 * The "pick a datasource to start a visualization" row, shared by the add-block
 * row and the between-blocks insert divider.
 */
export function InlineDataSourcePicker({ onSelect, onCancel }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <div className={styles.picker}>
        <DataSourcePicker current={null} autoFocus openMenuOnFocus onChange={onSelect} />
      </div>
      <IconButton name="times" tooltip={t('notebooks.add-cell.viz-cancel', 'Cancel')} onClick={onCancel} />
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="notebooks.add-cell.viz-hint">
          Tip: any dashboard panel or Explore query can also be added via “Add to notebook”.
        </Trans>
      </Text>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  picker: css({
    minWidth: 320,
  }),
});
