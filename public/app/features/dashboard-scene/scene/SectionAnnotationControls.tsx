import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneObject, type SceneVariables } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { DataLayerControlEditWrapper } from './DashboardDataLayerControls';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { SectionVariableControls } from './VariableControls';

export function SectionControlsRow({ variableSet, data }: { variableSet?: SceneVariables; data?: SceneObject }) {
  const styles = useStyles2(getStyles);

  return (
    // Prevent row selection on click (see RowItemRenderer onPointerUp)
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.sectionControls}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {variableSet && <SectionVariableControls variableSet={variableSet} />}
      <SectionAnnotationControls data={data} />
    </div>
  );
}

export function SectionAnnotationControls({ data }: { data?: SceneObject }) {
  if (!(data instanceof DashboardDataLayerSet)) {
    return null;
  }

  return <SectionAnnotationControlsInner dataLayerSet={data} />;
}

function SectionAnnotationControlsInner({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const { annotationLayers } = dataLayerSet.useState();
  const styles = useStyles2(getStyles);
  const visibleLayers = annotationLayers.filter(
    (layer) => !layer.state.isHidden && layer.state.placement === undefined
  );

  if (visibleLayers.length === 0) {
    return null;
  }

  return (
    <div className={styles.sectionAnnotations}>
      {visibleLayers.map((layer) => (
        <DataLayerControlEditWrapper key={layer.state.key} layer={layer} />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sectionControls: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    '&:empty': {
      display: 'none',
    },
  }),
  sectionAnnotations: css({
    display: 'contents',
  }),
});
