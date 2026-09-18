import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type QueryVariable } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { QueryVariableEditorModal } from './QueryVariableEditorModal';

export function PaneItem({ variable }: { variable: QueryVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display="flex" direction="column" paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.sidebar.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton}
        >
          <Trans i18nKey="dashboard.sidebar.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      {isOpen && <QueryVariableEditorModal variable={variable} onClose={() => setIsOpen(false)} />}
    </>
  );
}
