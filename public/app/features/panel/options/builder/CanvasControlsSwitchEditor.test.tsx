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
  describe('canvasControls is undefined', () => {
    it('should display switch as unchecked when multiLane is disabled', () => {
      render(<CanvasControlsSwitchEditor value={{ multiLane: false }} {...defaultProps} />);
      expect(screen.getByRole('switch')).not.toBeChecked();
    });
    it('should display switch as checked when multiLane is enabled', () => {
      render(<CanvasControlsSwitchEditor value={{ multiLane: true }} {...defaultProps} />);
      expect(screen.getByRole('switch')).toBeChecked();
    });
    it('should display switch as unchecked when multiLane is undefined', () => {
      render(<CanvasControlsSwitchEditor value={{}} {...defaultProps} />);
      expect(screen.getByRole('switch')).not.toBeChecked();
    });
  });
  describe('canvasControls is defined', () => {
    it('should be unchecked when canvasControls is enabled', () => {
      render(<CanvasControlsSwitchEditor value={{ ...CANVAS_CONTROLS_ENABLED, multiLane: true }} {...defaultProps} />);
      expect(screen.getByRole('switch')).not.toBeChecked();
    });
    it('should be checked when canvasControls is disabled', () => {
      render(
        <CanvasControlsSwitchEditor value={{ ...CANVAS_CONTROLS_DISABLED, multiLane: false }} {...defaultProps} />
      );
      expect(screen.getByRole('switch')).toBeChecked();
    });
  });
  describe('onChange', () => {
    it('should call onChange when toggling on', async () => {
      const onChange = jest.fn();
      render(
        <CanvasControlsSwitchEditor value={{ ...CANVAS_CONTROLS_DISABLED }} {...defaultProps} onChange={onChange} />
      );
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ...CANVAS_CONTROLS_ENABLED }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ...CANVAS_CONTROLS_ENABLED,
        })
      );
    });
    it('should call onChange when toggling off', async () => {
      const onChange = jest.fn();
      render(
        <CanvasControlsSwitchEditor value={{ ...CANVAS_CONTROLS_ENABLED }} {...defaultProps} onChange={onChange} />
      );
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ...CANVAS_CONTROLS_DISABLED }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ...CANVAS_CONTROLS_DISABLED,
        })
      );
    });
    it('should not change other annotation options', async () => {
      const onChange = jest.fn();
      const value = { multiLane: true, ...CANVAS_CONTROLS_DISABLED };
      render(<CanvasControlsSwitchEditor value={value} {...defaultProps} onChange={onChange} />);
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining(CANVAS_CONTROLS_ENABLED));
    });
    it('should call onChange with value undefined', async () => {
      const onChange = jest.fn();
      render(<CanvasControlsSwitchEditor value={undefined} {...defaultProps} onChange={onChange} />);
      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining(CANVAS_CONTROLS_DISABLED));
    });
  });
});
