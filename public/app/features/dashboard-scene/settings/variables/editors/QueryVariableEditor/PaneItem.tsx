import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { ModalEditor } from './ModalEditor';

export function PaneItem({ variable }: { variable: QueryVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
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
      {isOpen && <ModalEditor variable={variable} onClose={() => setIsOpen(false)} />}
    </>
  );
}
