import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaQueryVarEditorRedesign } from '@grafana/runtime/internal';
import { type QueryVariable } from '@grafana/scenes';
import { Box, Button, Modal } from '@grafana/ui';

import { ModalEditor } from './ModalEditor';
import { Editor } from './QueryVariableEditor';

export function PaneItem({ variable }: { variable: QueryVariable }) {
  const newQueryVarEditorEnabled = useFlagGrafanaQueryVarEditorRedesign();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display="flex" direction="column" paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      {isOpen && newQueryVarEditorEnabled && <ModalEditor variable={variable} onClose={() => setIsOpen(false)} />}
      {isOpen && !newQueryVarEditorEnabled && <OldModal variable={variable} onClose={() => setIsOpen(false)} />}
    </>
  );
}

function OldModal({ variable, onClose }: { variable: QueryVariable; onClose: () => void }) {
  const onRunQuery = () => {
    variable.refreshOptions();
  };

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.query-options.old-modal-title', 'Query Variable')}
      isOpen={true}
      onDismiss={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <Editor variable={variable} />
      <Modal.ButtonRow>
        <Button
          variant="primary"
          fill="outline"
          onClick={onRunQuery}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.query-options.preview">Preview</Trans>
        </Button>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onClose}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.query-options.close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
