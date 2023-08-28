import * as service from 'app/percona/shared/services/services/Services.service';

export const ServicesService = jest.genMockFromModule<typeof service>(
  'app/percona/shared/services/services/Services.service'
).ServicesService;

ServicesService.getActive = () =>
  Promise.resolve({
    service_types: [],
  });

ServicesService.removeService = () => Promise.resolve({});
