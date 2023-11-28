const DiscoveryService = jest.genMockFromModule('../Discovery.service').default;
DiscoveryService.discoveryRDS = () => Promise.resolve({
    rds_instances: [],
});
export default DiscoveryService;
//# sourceMappingURL=Discovery.service.js.map