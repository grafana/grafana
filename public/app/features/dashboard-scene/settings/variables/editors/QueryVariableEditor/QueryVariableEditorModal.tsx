import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaQueryVarEditorRedesign } from '@grafana/runtime/internal';
import { type QueryVariable } from '@grafana/scenes';
import { Button, Modal } from '@grafana/ui';

import { ModalEditor } from './ModalEditor';
import { Editor } from './QueryVariableEditor';

export function QueryVariableEditorModal({ variable, onClose }: { variable: QueryVariable; onClose: () => void }) {
  const newQueryVarEditorEnabled = useFlagGrafanaQueryVarEditorRedesign();

  if (newQueryVarEditorEnabled) {
    return <ModalEditor variable={variable} onClose={onClose} />;
  }

  return <OldModal variable={variable} onClose={onClose} />;
}

function OldModal({ variable, onClose }: { variable: QueryVariable; onClose: () => void }) {
  const onRunQuery = () => {
    variable.refreshOptions();
  };

  return (
    <Modal
      title={t('dashboard.sidebar.variable.query-options.old-modal-title', 'Query Variable')}
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
          <Trans i18nKey="dashboard.sidebar.variable.query-options.preview">Preview</Trans>
        </Button>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onClose}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
        >
          <Trans i18nKey="dashboard.sidebar.variable.query-options.close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
