import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, ButtonGroup, ConfirmModal, useStyles2 } from '@grafana/ui';

interface TransformationsActionsProps {
  onAddTransformation: () => void;
  onDeleteAll: () => void;
}

export function TransformationsActions({ onAddTransformation, onDeleteAll }: TransformationsActionsProps) {
  const styles = useStyles2(getStyles);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  return (
    <>
      <ButtonGroup>
        <Button
          icon="plus"
          variant="secondary"
          onClick={onAddTransformation}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          <Trans i18nKey="dashboard-scene.panel-data-transformations-tab-rendered.add-another-transformation">
            Add another transformation
          </Trans>
        </Button>
        <Button
          data-testid={selectors.components.Transforms.removeAllTransformationsButton}
          className={styles.removeAll}
          icon="times"
          variant="secondary"
          onClick={() => setConfirmModalOpen(true)}
        >
          <Trans i18nKey="dashboard-scene.panel-data-transformations-tab-rendered.delete-all-transformations">
            Delete all transformations
          </Trans>
        </Button>
      </ButtonGroup>
      <ConfirmModal
        isOpen={confirmModalOpen}
        title={t(
          'dashboard-scene.panel-data-transformations-tab-rendered.title-delete-all-transformations',
          'Delete all transformations?'
        )}
        body={t(
          'dashboard-scene.panel-data-transformations-tab-rendered.body-delete-all-transformations',
          'By deleting all transformations, you will go back to the main selection screen.'
        )}
        confirmText={t('dashboard-scene.panel-data-transformations-tab-rendered.confirmText-delete-all', 'Delete all')}
        onConfirm={() => {
          reportInteraction('grafana_panel_transformations_clicked', {
            context: 'transformations_list',
            action: 'delete_all',
          });
          onDeleteAll();
          setConfirmModalOpen(false);
        }}
        onDismiss={() => setConfirmModalOpen(false)}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  removeAll: css({
    marginLeft: theme.spacing(2),
  }),
});
