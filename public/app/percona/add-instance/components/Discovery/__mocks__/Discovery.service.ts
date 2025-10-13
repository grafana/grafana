import * as service from '../Discovery.service';

const DiscoveryService = jest.genMockFromModule<typeof service>('../Discovery.service').default;

DiscoveryService.discoveryRDS = () =>
  Promise.resolve({
    rds_instances: [],
  });

export default DiscoveryService;
