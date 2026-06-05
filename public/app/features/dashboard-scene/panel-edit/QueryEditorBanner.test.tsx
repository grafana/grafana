import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QueryEditorBanner } from './QueryEditorBanner';

const onToggle = jest.fn();
const onDismiss = jest.fn();

const renderComponent = (useQueryExperienceNext: boolean) =>
  render(
    <OpenFeatureTestProvider>
      <QueryEditorBanner useQueryExperienceNext={useQueryExperienceNext} onToggle={onToggle} onDismiss={onDismiss} />
    </OpenFeatureTestProvider>
  );

describe('QueryEditorBanner', () => {
  beforeEach(() => {
    onToggle.mockClear();
    onDismiss.mockClear();
  });

  describe('classic editor (useQueryExperienceNext = false)', () => {
    it('shows the upgrade title and "Try it out" button', () => {
      renderComponent(false);

      expect(screen.getByText('New editor available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try it out/i })).toBeInTheDocument();
    });

    it('does not show new-editor-specific content', () => {
      renderComponent(false);

      expect(screen.queryByText('Back to classic')).not.toBeInTheDocument();
    });

    it('calls onToggle when "Try it out" is clicked', async () => {
      renderComponent(false);

      await userEvent.click(screen.getByRole('button', { name: /try it out/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('new editor (useQueryExperienceNext = true)', () => {
    it('shows the new editor title and "Go back to classic" button', () => {
      renderComponent(true);

      expect(screen.getByText('New query editor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to classic/i })).toBeInTheDocument();
    });

    it('does not show "Try it out" button', () => {
      renderComponent(true);

      expect(screen.queryByRole('button', { name: /try it out/i })).not.toBeInTheDocument();
    });

    it('calls onToggle when "Go back to classic" is clicked', async () => {
      renderComponent(true);

      await userEvent.click(screen.getByRole('button', { name: /back to classic/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss', () => {
    it('calls onDismiss when dismiss button is clicked', async () => {
      renderComponent(false);

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
