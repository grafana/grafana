import { render, screen } from '../../../../../tests/test-utils';

import { StateText } from './StateText';

describe('StateText', () => {
  describe('alert type', () => {
    it('should render the state for "normal"', () => {
      render(<StateText state="normal" />);
      expect(screen.getByText('Normal')).toBeInTheDocument();
    });

    it('should render the state for "firing"', () => {
      render(<StateText state="firing" />);
      expect(screen.getByText('Firing')).toBeInTheDocument();
    });

    it('should render the state for "pending"', () => {
      render(<StateText state="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render the state for "paused"', () => {
      render(<StateText isPaused />);
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('should render "Error" when health is "error", even when state is "normal"', () => {
      render(<StateText state="normal" health="error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    });

    it('should render "No data" when health is "nodata", even when state is "firing"', () => {
      render(<StateText state="firing" health="nodata" />);
      expect(screen.getByText('No data')).toBeInTheDocument();
      expect(screen.queryByText('Firing')).not.toBeInTheDocument();
    });

    it('should render "Error" when health is "error", even when state is "pending"', () => {
      render(<StateText state="pending" health="error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });
  });

  describe('recording type', () => {
    it('should render "Recording" for recording rule type', () => {
      render(<StateText type="recording" />);
      expect(screen.getByText('Recording')).toBeInTheDocument();
    });

    it('should render "Recording error" for recording rule type when health is "error"', () => {
      render(<StateText type="recording" health="error" />);
      expect(screen.getByText('Recording error')).toBeInTheDocument();
    });
  });
});
