import { render, screen, within } from 'test/test-utils';

import { KnownProvenance } from '../types/knownProvenance';

import { ImportedResourceAlert, ProvisionedResource, ProvisioningBadge } from './Provisioning';

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

describe('ImportedResourceAlert', () => {
  it('should render the alert', () => {
    render(<ImportedResourceAlert resource={ProvisionedResource.ContactPoint} />);

    const alert = screen.getByRole('status');

    expect(alert).toBeInTheDocument();
  });

  it('should render the alert with the correct title for contact point', () => {
    render(<ImportedResourceAlert resource={ProvisionedResource.ContactPoint} />);

    const alert = screen.getByRole('status');

    expect(alert).toBeInTheDocument();

    expect(
      within(alert).getByText('This contact point was imported and cannot be edited through the UI')
    ).toBeInTheDocument();
  });

  it('should render the alert with the correct title for template', () => {
    render(<ImportedResourceAlert resource={ProvisionedResource.Template} />);

    const alert = screen.getByRole('status');

    expect(
      within(alert).getByText('This template was imported and cannot be edited through the UI')
    ).toBeInTheDocument();
  });

  it('should render the alert body with the correct resource name', () => {
    render(<ImportedResourceAlert resource={ProvisionedResource.ContactPoint} />);

    const alert = screen.getByRole('status');

    expect(within(alert).getByText(/This contact point contains integrations that were imported/)).toBeInTheDocument();
  });
});
