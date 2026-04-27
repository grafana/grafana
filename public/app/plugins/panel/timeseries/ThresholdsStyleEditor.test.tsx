import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

import type { StandardEditorContext, StandardEditorsRegistryItem } from '@grafana/data/field';
import type { SelectableValue } from '@grafana/data/types';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { getGraphFieldOptions } from '@grafana/ui';

import { ThresholdsStyleEditor } from './ThresholdsStyleEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<SelectableValue<{ mode: GraphThresholdsStyleMode }>> = {
  id: 'thresholdsStyle',
  name: 'Thresholds style',
  editor: ThresholdsStyleEditor,
  settings: { options: getGraphFieldOptions().thresholdsDisplayModes },
};

describe('ThresholdsStyleEditor', () => {
  it('should call onChange with the selected mode when option is changed', async () => {
    const onChange = jest.fn();
    render(
      <ThresholdsStyleEditor
        value={{ mode: GraphThresholdsStyleMode.Off }}
        onChange={onChange}
        context={mockContext}
        item={mockItem}
      />
    );

    const select = screen.getByRole('combobox');
    await selectEvent.select(select, 'As lines', { container: document.body });

    expect(onChange).toHaveBeenCalledWith({ mode: GraphThresholdsStyleMode.Line });
  });
});
