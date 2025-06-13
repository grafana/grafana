import { render } from '@testing-library/react';

import { AnnotationQuery, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

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

  it('v2 dashboard - should preserve legacyOptions field when changing target', () => {
    // Setup with annotation that has legacyOptions
    const mockOnChange = jest.fn();
    const { props } = setup({
      annotation: {
        name: 'annotationWithLegacyOptions',
        target: { refId: 'refId1' },
        legacyOptions: {
          expr: 'rate(http_requests_total[5m])',
          queryType: 'range',
        },
        enable: true,
        iconColor: 'red',
        hide: false,
      } as unknown as AnnotationQuery,
      onChange: mockOnChange,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // Get the onQueryChange function from the component instance
    const componentInstance = (props.datasource.annotations?.QueryEditor as jest.Mock).mock.calls[0][0];

    // Simulate changing the target
    componentInstance.onChange({ refId: 'refId2', newField: 'value' });

    // Check that legacyOptions are preserved
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { refId: 'refId2', newField: 'value' },
        legacyOptions: {
          expr: 'rate(http_requests_total[5m])',
          queryType: 'range',
        },
      })
    );
  });

  it('should preserve legacyOptions field when using onAnnotationChange', () => {
    // Setup with annotation that has legacyOptions
    const mockOnChange = jest.fn();
    const { props } = setup({
      annotation: {
        name: 'annotationWithLegacyOptions',
        legacyOptions: {
          expr: 'rate(http_requests_total[5m])',
          queryType: 'range',
        },
        enable: true,
        iconColor: 'blue',
        hide: false,
      } as unknown as AnnotationQuery,
      onChange: mockOnChange,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // Get the onAnnotationChange function from the component instance
    const componentInstance = (props.datasource.annotations?.QueryEditor as jest.Mock).mock.calls[0][0];

    // Simulate annotation change from child component
    componentInstance.onAnnotationChange({
      name: 'newName',
      iconColor: 'red',
    });

    // Check that legacyOptions are preserved
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'newName',
        iconColor: 'red',
        legacyOptions: {
          expr: 'rate(http_requests_total[5m])',
          queryType: 'range',
        },
      })
    );
  });

  it('should handle v2 dashboard annotations with query.spec', () => {
    const { props } = setup({
      annotation: {
        name: 'v2annotation',
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'rate(http_requests_total[5m])',
            refId: 'A',
          },
        },
      } as unknown as AnnotationQuery,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // Check that query.spec is used as target for QueryEditor
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          expr: 'rate(http_requests_total[5m])',
          refId: 'A',
        }),
      }),
      expect.anything()
    );
  });

  it('should propagate legacyOptions to root level for v2 dashboards', () => {
    const { props } = setup({
      annotation: {
        name: 'v2annotationWithLegacyOptions',
        query: {
          kind: 'prometheus',
          spec: {
            refId: 'A',
          },
        },
        legacyOptions: {
          expr: 'rate(http_requests_total[5m])',
          legendFormat: '{{method}} {{endpoint}}',
        },
      } as unknown as AnnotationQuery,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // Check that legacyOptions are propagated to root level for the editor
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: expect.objectContaining({
          name: 'v2annotationWithLegacyOptions',
          query: expect.anything(),
          legacyOptions: expect.anything(),
          expr: 'rate(http_requests_total[5m])',
          legendFormat: '{{method}} {{endpoint}}',
        }),
      }),
      expect.anything()
    );
  });

  it('should handle v1 dashboard with a prop name query but that is not a v2 spec', () => {
    const { props } = setup({
      annotation: {
        name: 'v1WithQueryNoSpec',
        target: { refId: 'AnnoTarget' },
        query: 'abcdefg', // v1 dashboard might have a prop called query, but is not v2, it does not have spec
        datasource: {
          type: 'prometheus',
          uid: 'abc123',
        },
        // v1 dashboards don't have legacyOptions field
        enable: true,
        iconColor: 'red',
        hide: false,
      } as unknown as AnnotationQuery,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // The QueryEditor is called with the annotation object, we should check that
    // it contains the correct annotation object with our query
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: expect.objectContaining({
          name: 'v1WithQueryNoSpec',
          target: { refId: 'AnnoTarget' },
          // v1 dashboard might have a prop called query, but is not v2, it does not have spec
          query: 'abcdefg',
        }),
        // The query will be the target object after processing
        query: expect.objectContaining({
          refId: 'AnnoTarget',
        }),
      }),
      expect.anything()
    );
  });

  it('should work with v1 dashboards that have target field', () => {
    const { props } = setup({
      annotation: {
        name: 'v1WithTarget',
        target: {
          refId: 'A',
          expr: 'up',
        },
        datasource: {
          type: 'prometheus',
          uid: 'abc123',
        },
        enable: true,
        iconColor: 'green',
        hide: false,
      } as unknown as AnnotationQuery,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    // Should use existing target for v1 dashboards
    expect(props.datasource?.annotations?.QueryEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          refId: 'A',
          expr: 'up',
        }),
      }),
      expect.anything()
    );
  });

  it('should handle both onQueryChange and onChange handlers from datasource plugins', () => {
    const mockOnChange = jest.fn();
    const { props } = setup({
      annotation: {
        name: 'annotation',
        target: { refId: 'A' },
        iconColor: 'yellow',
        hide: false,
      } as unknown as AnnotationQuery,
      onChange: mockOnChange,
      datasource: {
        annotations: {
          QueryEditor: jest.fn(() => <div>Editor</div>),
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi,
    });

    const componentInstance = (props.datasource.annotations?.QueryEditor as jest.Mock).mock.calls[0][0];

    // Test onQueryChange handler
    componentInstance.onChange({ refId: 'B', expr: 'new_expr' });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { refId: 'B', expr: 'new_expr' },
      })
    );
    mockOnChange.mockClear();

    // Test onAnnotationChange handler
    componentInstance.onAnnotationChange({
      name: 'updated',
      iconColor: 'blue',
      enable: false,
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'updated',
        iconColor: 'blue',
        enable: false,
      })
    );
  });
});
