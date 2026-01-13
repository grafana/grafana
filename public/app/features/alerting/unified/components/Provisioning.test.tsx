import { render, screen } from 'test/test-utils';

import { KnownProvenance } from '../types/knownProvenance';

import { ProvisioningBadge } from './Provisioning';

describe('ProvisioningBadge', () => {
  describe('when the provenance is file', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={KnownProvenance.File} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={KnownProvenance.File} />);

      const badge = screen.getByText('Provisioned');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via file and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });

  describe('when the provenance is ConvertedPrometheus', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={KnownProvenance.ConvertedPrometheus} />);

      expect(screen.getByText('Imported')).toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={KnownProvenance.ConvertedPrometheus} />);

      const badge = screen.getByText('Imported');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via Prometheus/Mimir and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });

  describe('when the provenance is API', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={KnownProvenance.API} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={KnownProvenance.API} />);

      const badge = screen.getByText('Provisioned');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via api and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });
});
