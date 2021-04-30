// import React from 'react';
// import { render } from '@testing-library/react';
// import { Preprocessor } from './Preprocessor';
// import { defaultQuery } from './MetricQueryEditor';
// import { MetricDescriptor } from '../types';
// import CloudMonitoringDatasource from '../datasource';

// const mockDatasource: Partial<CloudMonitoringDatasource> = {
//   getDefaultProject: jest.fn().mockResolvedValueOnce('testproj'),
// };

// let query = defaultQuery(mockDatasource as CloudMonitoringDatasource);

// test('Simulates selection', () => {
//   const { getAllByTestId } = render(
//     <Preprocessor metricDescriptor={{} as MetricDescriptor} query={query} onChange={(query) => {}} />
//   );

//   let options = getAllByTestId('cloud-monitoring-preprocessor-options');
//   expect(options).toHaveLength(1);
// });
