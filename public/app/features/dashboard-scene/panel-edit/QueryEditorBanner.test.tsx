import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QueryEditorBanner } from './QueryEditorBanner';

const onToggle = jest.fn();
const onDismiss = jest.fn();

describe('QueryEditorBanner', () => {
  beforeEach(() => {
    onToggle.mockClear();
    onDismiss.mockClear();
  });

  describe('classic editor (useQueryExperienceNext = false)', () => {
    it('shows the upgrade title and "Try it out" button', () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} onDismiss={onDismiss} />);

      expect(screen.getByText('New editor available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try it out/i })).toBeInTheDocument();
    });

    it('does not show new-editor-specific content', () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} onDismiss={onDismiss} />);

      expect(screen.queryByText('Back to classic')).not.toBeInTheDocument();
    });

    it('calls onToggle when "Try it out" is clicked', async () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} onDismiss={onDismiss} />);

      await userEvent.click(screen.getByRole('button', { name: /try it out/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('new editor (useQueryExperienceNext = true)', () => {
    it('shows the new editor title and "Go back to classic" button', () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} onDismiss={onDismiss} />);

      expect(screen.getByText('New query editor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to classic/i })).toBeInTheDocument();
    });

    it('does not show "Try it out" button', () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} onDismiss={onDismiss} />);

      expect(screen.queryByRole('button', { name: /try it out/i })).not.toBeInTheDocument();
    });

    it('calls onToggle when "Go back to classic" is clicked', async () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} onDismiss={onDismiss} />);

      await userEvent.click(screen.getByRole('button', { name: /back to classic/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss', () => {
    it('calls onDismiss when dismiss button is clicked', async () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} onDismiss={onDismiss} />);

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
