import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { ScrollContainer, useStyles2, Box } from '@grafana/ui';

import { DashboardSidebar } from './DashboardSidebar';
import { ElementEditPaneHeader } from './ElementEditPaneHeader';
import { getEditableElementForSelection } from './shared';

export class ElementEditPane extends SceneObjectBase {
  public static Component = ElementEditPaneRenderer;
  protected static _renderBeforeActivation = true;

  public getId() {
    return 'element' as const;
  }
}

function ElementEditPaneRenderer({ model }: SceneComponentProps<ElementEditPane>) {
  const styles = useStyles2(getStyles);

  const sidebar = sceneGraph.getAncestor(model, DashboardSidebar);
  const selected = sidebar.state.selectionContext.selected;

  const element = useMemo(() => {
    return getEditableElementForSelection(sidebar, selected);
  }, [sidebar, selected]);

  const categories = element?.useSidebarOptions ? element.useSidebarOptions(sidebar.state.isNewElement) : [];

  if (!element) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <ElementEditPaneHeader element={element} sidebar={sidebar} />
      <ScrollContainer showScrollIndicators={true}>
        <div className={styles.categories}>
          {element.renderTopButton && (
            <Box display="flex" alignItems={'center'} paddingTop={2} paddingLeft={2} paddingRight={2}>
              {element.renderTopButton()}
            </Box>
          )}
          {categories.map((cat) => cat.renderElement())}
        </div>
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
