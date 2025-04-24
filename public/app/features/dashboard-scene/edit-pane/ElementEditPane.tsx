import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { DashboardEditPane } from './DashboardEditPane';
import { EditPaneHeader } from './EditPaneHeader';

export interface Props {
  element: EditableDashboardElement;
  editPane: DashboardEditPane;
  isNewElement: boolean;
}

export function ElementEditPane({ element, editPane, isNewElement }: Props) {
  const categories = element.useEditPaneOptions ? element.useEditPaneOptions(isNewElement) : [];
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <EditPaneHeader element={element} editPane={editPane} />
      <ScrollContainer showScrollIndicators={true}>
        <div className={styles.categories}>{categories.map((cat) => cat.render())}</div>
      </ScrollContainer>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      height: '100%',
    }),
    categories: css({
      display: 'flex',
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
