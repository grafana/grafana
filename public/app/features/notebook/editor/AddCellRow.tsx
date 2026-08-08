import { css } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { InlineDataSourcePicker } from './InlineDataSourcePicker';

interface Props {
  onAddText: () => void;
  onAddCode: () => void;
  onAddViz: (datasource: DataSourceInstanceSettings) => void;
}

/**
 * "Add block" affordance at the end of the notebook. Text and code blocks are
 * created inline; a visualization starts from a datasource pick (and can also be
 * captured from any dashboard panel menu or Explore).
 */
export function AddCellRow({ onAddText, onAddCode, onAddViz }: Props) {
  const styles = useStyles2(getStyles);
  const [pickingDatasource, setPickingDatasource] = useState(false);

  return (
    <div className={styles.row} data-testid="notebook-add-cell">
      {pickingDatasource ? (
        <InlineDataSourcePicker
          onSelect={(ds) => {
            setPickingDatasource(false);
            onAddViz(ds);
          }}
          onCancel={() => setPickingDatasource(false)}
        />
      ) : (
        <Stack direction="row" gap={1} alignItems="center">
          <Button variant="secondary" fill="outline" size="sm" icon="text-fields" onClick={onAddText}>
            <Trans i18nKey="notebooks.add-cell.text">Text</Trans>
          </Button>
          <Button variant="secondary" fill="outline" size="sm" icon="brackets-curly" onClick={onAddCode}>
            <Trans i18nKey="notebooks.add-cell.code">Code</Trans>
          </Button>
          <Button
            variant="secondary"
            fill="outline"
            size="sm"
            icon="graph-bar"
            onClick={() => setPickingDatasource(true)}
          >
            <Trans i18nKey="notebooks.add-cell.visualization">Visualization</Trans>
          </Button>
        </Stack>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    paddingTop: theme.spacing(2),
    borderTop: `1px dashed ${theme.colors.border.weak}`,
    marginTop: theme.spacing(2),
  }),
});
