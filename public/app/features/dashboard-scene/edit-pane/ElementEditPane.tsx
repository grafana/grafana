import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { EditableDashboardElement } from '../scene/types';

export interface Props {
  element: EditableDashboardElement;
}

export function ElementEditPane({ element }: Props) {
  const categories = element.useEditPaneOptions();
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      {element.renderActions && (
        <OptionsPaneCategory
          id="selected-item"
          title={element.getTypeName()}
          isOpenDefault={true}
          className={styles.noBorderTop}
        >
          <div className={styles.actionsBox}>{element.renderActions()}</div>
        </OptionsPaneCategory>
      )}
      {categories.map((cat) => cat.render())}
    </Stack>
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
