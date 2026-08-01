import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Modal, Stack, Text, useStyles2 } from '@grafana/ui';

interface Props {
  onAddText: () => void;
  onAddCode: () => void;
}

/**
 * "Add block" affordance at the end of the notebook. Text and code cells are created
 * inline; visualizations are added from their source contexts (dashboard panel menu
 * or Explore toolbar), which a small helper modal explains.
 */
export function AddCellRow({ onAddText, onAddCode }: Props) {
  const styles = useStyles2(getStyles);
  const [showVizHelp, setShowVizHelp] = useState(false);

  return (
    <div className={styles.row} data-testid="notebook-add-cell">
      <Stack direction="row" gap={1} alignItems="center">
        <Button variant="secondary" fill="outline" size="sm" icon="text-fields" onClick={onAddText}>
          <Trans i18nKey="notebooks.add-cell.text">Text</Trans>
        </Button>
        <Button variant="secondary" fill="outline" size="sm" icon="brackets-curly" onClick={onAddCode}>
          <Trans i18nKey="notebooks.add-cell.code">Code</Trans>
        </Button>
        <Button variant="secondary" fill="outline" size="sm" icon="graph-bar" onClick={() => setShowVizHelp(true)}>
          <Trans i18nKey="notebooks.add-cell.visualization">Visualization</Trans>
        </Button>
      </Stack>

      <Modal
        isOpen={showVizHelp}
        title={t('notebooks.add-cell.viz-title', 'Add a visualization')}
        onDismiss={() => setShowVizHelp(false)}
      >
        <Stack direction="column" gap={2}>
          <Text element="p">
            <Trans i18nKey="notebooks.add-cell.viz-body">
              Visualizations are added to a notebook from where the data lives: open any dashboard panel menu and choose
              Add to notebook, or run a query in Explore and use Add to notebook in the toolbar. The panel is embedded
              live and follows the time range of this notebook.
            </Trans>
          </Text>
          <Stack direction="row" gap={1}>
            <LinkButton variant="secondary" icon="apps" href="/dashboards">
              <Trans i18nKey="notebooks.add-cell.viz-dashboards">Browse dashboards</Trans>
            </LinkButton>
            <LinkButton variant="secondary" icon="compass" href="/explore">
              <Trans i18nKey="notebooks.add-cell.viz-explore">Open Explore</Trans>
            </LinkButton>
          </Stack>
        </Stack>
      </Modal>
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
