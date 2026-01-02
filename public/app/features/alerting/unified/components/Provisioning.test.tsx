import { render, screen } from 'test/test-utils';

import { Provenance } from '../types/provenance';

import { ProvisioningBadge } from './Provisioning';

describe('ProvisioningBadge', () => {
  describe('when the provenance is file', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={Provenance.File} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText('Provisioned from Prometheus/Mimir')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={Provenance.File} />);

      const badge = screen.getByText('Provisioned');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via file and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });

  describe('when the provenance is ConvertedPrometheus', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={Provenance.ConvertedPrometheus} />);

      expect(screen.getByText('Provisioned from Prometheus/Mimir')).toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={Provenance.ConvertedPrometheus} />);

      const badge = screen.getByText('Provisioned from Prometheus/Mimir');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via Prometheus/Mimir and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });

  describe('when the provenance is API', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={Provenance.API} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText('Provisioned from Prometheus/Mimir')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={Provenance.API} />);

      const badge = screen.getByText('Provisioned');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned via api and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });

  describe('when the provenance is None', () => {
    it('should render the badge with the correct text', () => {
      render(<ProvisioningBadge provenance={Provenance.None} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText('Provisioned from Prometheus/Mimir')).not.toBeInTheDocument();
    });

    it('should render correct tooltip text', async () => {
      const { user } = render(<ProvisioningBadge tooltip provenance={Provenance.None} />);

      const badge = screen.getByText('Provisioned');
      await user.hover(badge);

      expect(
        screen.getByText('This resource has been provisioned and cannot be edited through the UI')
      ).toBeInTheDocument();
    });
  });
});
