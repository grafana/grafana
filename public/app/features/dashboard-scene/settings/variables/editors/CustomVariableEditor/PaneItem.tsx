import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { ModalEditor } from './ModalEditor';

interface PaneItemProps {
  variable: CustomVariable;
  id?: string;
}

export function PaneItem({ variable }: PaneItemProps) {
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
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      <ModalEditor variable={variable} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
