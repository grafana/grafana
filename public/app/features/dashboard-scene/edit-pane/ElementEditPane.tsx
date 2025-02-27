import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

export interface Props {
  element: EditableDashboardElement | MultiSelectedEditableDashboardElement;
}

export function ElementEditPane({ element }: Props) {
  const categories = element.useEditPaneOptions ? element.useEditPaneOptions() : [];
  const styles = useStyles2(getStyles);
  const elementInfo = element.getEditableElementInfo();

  return (
    <Stack direction="column" gap={0}>
      {element.renderActions && (
        <OptionsPaneCategory
          id="selected-item"
          title={elementInfo.name}
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
