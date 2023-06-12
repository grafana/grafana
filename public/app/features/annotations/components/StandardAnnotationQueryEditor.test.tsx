import { render } from '@testing-library/react';
import React from 'react';

import { AnnotationQuery, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data/src';

import StandardAnnotationQueryEditor, { Props as EditorProps } from './StandardAnnotationQueryEditor';

const setup = (customProps: Partial<EditorProps>) => {
  const props: EditorProps = {
    datasource: {} as unknown as DataSourceApi,
    datasourceInstanceSettings: {} as DataSourceInstanceSettings,
    annotation: {} as AnnotationQuery,
    onChange: jest.fn(),
    ...customProps,
  };
  const { rerender } = render(<StandardAnnotationQueryEditor {...props} />);
  return { rerender, props };
};

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: jest.fn().mockReturnValue({
    getCurrent: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange: jest.fn().mockReturnValue({}),
  }),
}));

describe('StandardAnnotationQueryEditor', () => {
  it('should fill out a default query if it is defined and pass it to the Query Editor', () => {
    const { props } = setup({
      annotation: { name: 'initialAnn', target: { refId: 'initialAnnotationRef' } } as AnnotationQuery,

      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          getDefaultQuery: jest.fn().mockImplementation(() => ({ queryType: 'defaultAnnotationsQuery' })),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });
    expect(props.datasource?.annotations?.getDefaultQuery).toBeDefined();
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ queryType: 'defaultAnnotationsQuery', refId: 'initialAnnotationRef' }),
      }),
      expect.anything()
    );
  });
  it('should keep and pass the initial query if the defaultQuery is not defined', () => {
    const { props } = setup({
      annotation: { name: 'initialAnn', target: { refId: 'initialAnnotationRef' } } as AnnotationQuery,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ refId: 'initialAnnotationRef' }),
      }),
      expect.anything()
    );
  });
});
