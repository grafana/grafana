export const ServicesService = jest.genMockFromModule('app/percona/shared/services/services/Services.service').ServicesService;
ServicesService.getActive = () => Promise.resolve({
    service_types: [],
});
ServicesService.removeService = () => Promise.resolve({});
//# sourceMappingURL=Services.service.js.map