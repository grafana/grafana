import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { QUERY_EDITOR_BANNER_DISMISSED_KEY } from './PanelEditNext/constants';
import { QueryEditorBanner } from './QueryEditorBanner';

const onToggle = jest.fn();

describe('QueryEditorBanner', () => {
  let originalFeatureToggle: boolean | undefined;

  beforeEach(() => {
    originalFeatureToggle = config.featureToggles.queryEditorNext;
    config.featureToggles.queryEditorNext = true;
    sessionStorage.clear();
    onToggle.mockClear();
  });

  afterEach(() => {
    config.featureToggles.queryEditorNext = originalFeatureToggle;
  });

  describe('visibility', () => {
    it('renders when feature toggle is enabled and banner is not dismissed', () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);
      expect(screen.getByText('New editor available!')).toBeInTheDocument();
    });

    it('does not render when feature toggle is disabled', () => {
      config.featureToggles.queryEditorNext = false;
      const { container } = render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when previously dismissed via sessionStorage', () => {
      sessionStorage.setItem(QUERY_EDITOR_BANNER_DISMISSED_KEY, 'true');
      const { container } = render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('dismiss', () => {
    it('hides the banner and persists to sessionStorage', async () => {
      const { container } = render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(container).toBeEmptyDOMElement();
      expect(sessionStorage.getItem(QUERY_EDITOR_BANNER_DISMISSED_KEY)).toBe('true');
    });
  });

  describe('classic editor (useQueryExperienceNext = false)', () => {
    it('shows the upgrade title and InlineSwitch', () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);

      expect(screen.getByText('New editor available!')).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle between query editor/i)).toBeInTheDocument();
    });

    it('does not show new-editor-specific content', () => {
      render(<QueryEditorBanner useQueryExperienceNext={false} onToggle={onToggle} />);

      expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
      expect(screen.queryByText('Go back to classic')).not.toBeInTheDocument();
    });
  });

  describe('new editor (useQueryExperienceNext = true)', () => {
    it('shows the new editor title, "Learn more" link, and "Go back to classic" button', () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} />);

      expect(screen.getByText('New query editor!')).toBeInTheDocument();
      expect(screen.getByText('Learn more')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back to classic/i })).toBeInTheDocument();
    });

    it('does not show the InlineSwitch', () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} />);

      expect(screen.queryByLabelText(/toggle between query editor/i)).not.toBeInTheDocument();
    });

    it('calls onToggle when "Go back to classic" is clicked', async () => {
      render(<QueryEditorBanner useQueryExperienceNext={true} onToggle={onToggle} />);

      await userEvent.click(screen.getByRole('button', { name: /go back to classic/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
