import { useCallback } from 'react';

import { Combobox, InlineField } from '@grafana/ui';

import { DependencyGraphControls } from '../../hooks/useDependencyGraphControls';
import { VisualizationMode } from '../../hooks/useDependencyGraphData';

interface VisualizationModeSelectorProps {
  controls: DependencyGraphControls;
}

/**
 * Component for selecting the visualization mode
 */
export function VisualizationModeSelector({ controls }: VisualizationModeSelectorProps): JSX.Element {
  const { visualizationMode, setVisualizationMode, modeOptions } = controls;

  const handleModeChange = useCallback(
    (option: { value?: VisualizationMode }) => {
      if (
        option.value &&
        (option.value === 'exposedComponents' ||
          option.value === 'addedlinks' ||
          option.value === 'addedcomponents' ||
          option.value === 'addedfunctions' ||
          option.value === 'extensionpoint')
      ) {
        setVisualizationMode(option.value);
      }
    },
    [setVisualizationMode]
  );

  return (
    <InlineField>
      <Combobox<VisualizationMode>
        options={modeOptions}
        value={visualizationMode}
        onChange={handleModeChange}
        width={22}
      />
    </InlineField>
  );
}
