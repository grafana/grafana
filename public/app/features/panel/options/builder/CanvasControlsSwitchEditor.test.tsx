import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CanvasControlsSwitchEditor,
  CANVAS_CONTROLS_DISABLED,
  CANVAS_CONTROLS_ENABLED,
} from './CanvasControlsSwitchEditor';
const defaultProps = {
  onChange: () => {},
  item: {} as never,
  context: {} as never,
};
describe('CanvasControlsSwitchEditor', () => {
  it('should render', () => {
    render(<CanvasControlsSwitchEditor value={{}} {...defaultProps} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
  describe('when canvasControls is undefined (user has not set a value)', () => {
    it('should display switch as checked when multiLane is disabled', () => {
      render(<CanvasControlsSwitchEditor value={{ multiLane: false }} {...defaultProps} />);
      expect(screen.getByRole('switch')).toBeChecked();
    });
    it('should display switch as checked when multiLane is undefined (defaults to disabled)', () => {
      render(<CanvasControlsSwitchEditor value={{}} {...defaultProps} />);
      expect(screen.getByRole('switch')).toBeChecked();
    });
    it('should display switch as unchecked when multiLane is enabled', () => {
      render(<CanvasControlsSwitchEditor value={{ multiLane: true }} {...defaultProps} />);
      expect(screen.getByRole('switch')).not.toBeChecked();
    });
  });
  describe('when canvasControls is set (user has set a value)', () => {
    it('should display switch as checked when canvasControls is enabled, regardless of multiLane', () => {
      render(
        <CanvasControlsSwitchEditor
          value={{ canvasControls: CANVAS_CONTROLS_ENABLED, multiLane: true }}
          {...defaultProps}
        />
      );
      expect(screen.getByRole('switch')).toBeChecked();
    });
    it('should display switch as unchecked when canvasControls is disabled, regardless of multiLane', () => {
      render(
        <CanvasControlsSwitchEditor
          value={{ canvasControls: CANVAS_CONTROLS_DISABLED, multiLane: false }}
          {...defaultProps}
        />
      );
      expect(screen.getByRole('switch')).not.toBeChecked();
    });
  });
  describe('onChange', () => {
    it('should call onChange with CANVAS_CONTROLS_ENABLED when toggling from off to on', async () => {
      const onChange = jest.fn();
      render(
        <CanvasControlsSwitchEditor
          value={{ canvasControls: CANVAS_CONTROLS_DISABLED }}
          {...defaultProps}
          onChange={onChange}
        />
      );
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ canvasControls: CANVAS_CONTROLS_ENABLED }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasControls: expect.objectContaining({
            lines: expect.objectContaining({ width: 2 }),
            regions: expect.objectContaining({ opacity: 0.1 }),
          }),
        })
      );
    });
    it('should call onChange with CANVAS_CONTROLS_DISABLED when toggling from on to off', async () => {
      const onChange = jest.fn();
      render(
        <CanvasControlsSwitchEditor
          value={{ canvasControls: CANVAS_CONTROLS_ENABLED }}
          {...defaultProps}
          onChange={onChange}
        />
      );
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ canvasControls: CANVAS_CONTROLS_DISABLED }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasControls: expect.objectContaining({
            lines: expect.objectContaining({ width: 0 }),
            regions: expect.objectContaining({ opacity: 0 }),
          }),
        })
      );
    });
    it('should preserve other annotation properties when toggling', async () => {
      const onChange = jest.fn();
      const value = { multiLane: true, canvasControls: CANVAS_CONTROLS_DISABLED };
      render(<CanvasControlsSwitchEditor value={value} {...defaultProps} onChange={onChange} />);
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          multiLane: true,
          canvasControls: CANVAS_CONTROLS_ENABLED,
        })
      );
    });
  });
});
