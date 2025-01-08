import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/ui';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';

import { EditableDashboardElement } from '../scene/types';

export interface Props {
  element: EditableDashboardElement;
}

export function ElementEditPane({ element }: Props) {
  const categories = element.useEditPaneOptions();

  return (
    <AddonBarPane title={element.getTypeName()} actions={element.renderActions && element.renderActions()}>
      <Stack direction="column" gap={0}>
        {categories.map((cat) => cat.render())}
      </Stack>
    </AddonBarPane>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noBorderTop: css({
      borderTop: 'none',
    }),
    actionsBox: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
  };
}
