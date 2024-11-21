import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject, VizPanel } from '@grafana/scenes';
import { Box, Stack, useStyles2 } from '@grafana/ui';

import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types';

import { VizPanelEditableElement } from './VizPanelEditableElement';

export interface Props {
  obj: SceneObject;
}

export function ElementEditPane({ obj }: Props) {
  const element = getEditableElementFor(obj);
  const categories = useMemo(() => element.getEditPaneOptions(), [element]);
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      <div className={styles.actionsBox}>{element.renderActions()}</div>
      {categories.map((cat) => cat.render())}
    </Stack>
  );
}

function getEditableElementFor(obj: SceneObject): EditableDashboardElement {
  if (isEditableDashboardElement(obj)) {
    return obj;
  }

  /**
   * For scene objects defined in scenes lib we have these wrappers that act as the element
   */
  if (obj instanceof VizPanel) {
    return new VizPanelEditableElement(obj);
  }

  throw new Error("Can't find editable element for selected object");
}

function getStyles(theme: GrafanaTheme2) {
  return {
    actionsBox: css({
      padding: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
