import { DependencyGraphControlsComponent } from './components/DependencyGraphControls';
import { DependencyGraphErrorBoundary } from './components/DependencyGraphErrorBoundary';
import { DependencyGraphHeader } from './components/DependencyGraphHeader';
import { DependencyGraphVisualization } from './components/DependencyGraphVisualization';
import { useDependencyGraphControls } from './hooks/useDependencyGraphControls';

// Layout constants
const LAYOUT_CONSTANTS = {
  PADDING: 16,
} as const;

/**
 * Main dependency graph tab component
 * This component orchestrates all the dependency graph functionality
 */
export function DependencyGraphTab(): JSX.Element {
  const controls = useDependencyGraphControls();

  return (
    <DependencyGraphErrorBoundary>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginTop: LAYOUT_CONSTANTS.PADDING }}>
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
