import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  describe('Fill style selection', () => {
    it('should render with Solid selected when value is undefined', () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={undefined!} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /solid/i })).toBeChecked();
    });

    it('should call onChange with dash defaults when Dash is selected', async () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /dash/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'dash', dash: [10, 10] });
    });

    it('should call onChange with dot defaults when Dots is selected', async () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /dots/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'dot', dash: [0, 10] });
    });

    it('should call onChange with no dash when Solid is selected', async () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [10, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      await userEvent.click(screen.getByRole('radio', { name: /solid/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'solid', dash: undefined });
    });

    describe('Accessible fill', () => {
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

          render(
            <LineStyleEditor value={{ fill: 'solid' }} onChange={jest.fn()} context={mockContext} item={mockItem} />
          );

          expect(screen.queryByRole('radio', { name: 'Accessible' })).not.toBeInTheDocument();
          expect(screen.getAllByRole('radio')).toHaveLength(3);
        }
      );

      it('shows the Accessible line fill option when enableColorblindSafePanelOptions is true', () => {
        config.featureToggles.enableColorblindSafePanelOptions = true;

        render(
          <LineStyleEditor value={{ fill: 'solid' }} onChange={jest.fn()} context={mockContext} item={mockItem} />
        );

        expect(screen.getByRole('radio', { name: 'Accessible' })).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(4);
      });
    });
  });

  describe('Segment selector', () => {
    it('should not show segment selector when fill is solid', () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.queryByText('10, 10')).not.toBeInTheDocument();
    });

    it('should show segment selector when fill is dash', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [10, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show default segments when dash array is empty', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor value={{ fill: 'dash', dash: [] }} onChange={onChange} context={mockContext} item={mockItem} />
      );

      expect(screen.getByText('10, 10')).toBeInTheDocument();
    });

    it('should show current segments for a predefined dash option', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [20, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('20, 10')).toBeInTheDocument();
    });

    it('should display a custom value not in the predefined options', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [7, 3, 7] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('7, 3, 7')).toBeInTheDocument();
    });
  });
});
