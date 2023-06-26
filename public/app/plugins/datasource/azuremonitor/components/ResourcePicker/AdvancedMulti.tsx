import React, { useState } from 'react';

import { Collapse } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorResource } from '../../types';
import { Space } from '../Space';

export interface ResourcePickerProps<T> {
  resources: T[];
  onChange: (resources: T[]) => void;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
}

const AdvancedMulti = ({ resources, onChange, renderAdvanced }: ResourcePickerProps<string | AzureMonitorResource>) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(!!resources.length && JSON.stringify(resources).includes('$'));

  return (
    <div data-testid={selectors.components.queryEditor.resourcePicker.advanced.collapse}>
      <Collapse
        collapsible
        label="Advanced"
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {renderAdvanced(resources, onChange)}
        <Space v={2} />
      </Collapse>
    </div>
  );
};

export default AdvancedMulti;
