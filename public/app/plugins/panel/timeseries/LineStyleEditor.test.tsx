import { render, screen } from '@testing-library/react';

import { type StandardEditorContext, type StandardEditorsRegistryItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type LineStyle } from '@grafana/schema';

import { LineStyleEditor } from './LineStyleEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<LineStyle> = {
  id: 'lineStyle',
  name: 'Line style',
  editor: LineStyleEditor,
};

describe('LineStyleEditor', () => {
  let originalEnableColorblindSafePanelOptions: boolean | undefined;

  beforeEach(() => {
    originalEnableColorblindSafePanelOptions = config.featureToggles.enableColorblindSafePanelOptions;
  });

  afterEach(() => {
    config.featureToggles.enableColorblindSafePanelOptions = originalEnableColorblindSafePanelOptions;
  });

  it.each([false, undefined])(
    'does not show the Accessible line fill option when enableColorblindSafePanelOptions is %s',
    (flagValue) => {
      config.featureToggles.enableColorblindSafePanelOptions = flagValue;

      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={jest.fn()} context={mockContext} item={mockItem} />);

      expect(screen.queryByRole('radio', { name: 'Accessible' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    }
  );

  it('shows the Accessible line fill option when enableColorblindSafePanelOptions is true', () => {
    config.featureToggles.enableColorblindSafePanelOptions = true;

    render(<LineStyleEditor value={{ fill: 'solid' }} onChange={jest.fn()} context={mockContext} item={mockItem} />);

    expect(screen.getByRole('radio', { name: 'Accessible' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });
});
