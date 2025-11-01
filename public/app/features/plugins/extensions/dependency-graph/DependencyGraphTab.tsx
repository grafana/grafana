import { css } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';

import { DependencyGraphControlsComponent } from './components/DependencyGraphControls';
import { DependencyGraphErrorBoundary } from './components/DependencyGraphErrorBoundary';
import { DependencyGraphHeader } from './components/DependencyGraphHeader';
import { DependencyGraphVisualization } from './components/DependencyGraphVisualization';
import { LAYOUT_CONSTANTS } from './dependency-graph-panel/constants';
import { useDependencyGraphControls } from './hooks/useDependencyGraphControls';

/**
 * Main dependency graph tab component
 * This component orchestrates all the dependency graph functionality
 */
export function DependencyGraphTab(): JSX.Element {
  const controls = useDependencyGraphControls();
  const styles = useStyles2(getStyles);

  return (
    <DependencyGraphErrorBoundary>
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <DependencyGraphHeader controls={controls} />

          {/* Controls Section */}

          <DependencyGraphControlsComponent controls={controls} />
        </div>

        {/* Visualization Section */}
        <DependencyGraphVisualization controls={controls} />
      </div>
    </DependencyGraphErrorBoundary>
  );
}

const getStyles = () => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    headerSection: css({
      marginTop: LAYOUT_CONSTANTS.TAB_PADDING,
    }),
  };
};
