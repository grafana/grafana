export const successfulDataQuery = {
  results: {
    A: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'A',
            fields: [
              {
                name: 'col1',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                  nullable: true,
                },
              },
              {
                name: 'col2',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                  nullable: true,
                },
              },
            ],
          },
          data: {
            values: [
              ['val1', 'val3'],
              ['val2', 'val4'],
            ],
          },
        },
      ],
    },
  },
};

export const failedAnnotationQuery: object = {
  results: {
    Anno: {
      error: 'Google API Error 400',
      errorSource: '',
      status: 500,
    },
  },
};

export const failedAnnotationQueryWithMultipleErrors: object = {
  results: {
    Anno1: {
      error: 'Google API Error 400',
      errorSource: '',
      status: 400,
    },
    Anno2: {
      error: 'Google API Error 401',
      errorSource: '',
      status: 401,
    },
  },
};

export const successfulAnnotationQueryWithData: object = {
  results: {
    Anno: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'Anno',
            fields: [
              {
                name: 'time',
                type: 'time',
                typeInfo: {
                  frame: 'time.Time',
                  nullable: true,
                },
              },
              {
                name: 'col2',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                  nullable: true,
                },
              },
            ],
          },
          data: {
            values: [
              [1702973084093, 1702973084099],
              ['val1', 'val2'],
            ],
          },
        },
      ],
    },
  },
};

export const successfulAnnotationQueryWithoutData: object = {
  results: {
    Anno: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'Anno',
            fields: [
              {
                name: 'time',
                type: 'time',
                typeInfo: {
                  frame: 'time.Time',
                  nullable: true,
                },
              },
              {
                name: 'col2',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                  nullable: true,
                },
              },
            ],
          },
          data: {
            values: [],
          },
        },
      ],
    },
  },
};
