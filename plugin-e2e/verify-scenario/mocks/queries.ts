export const testDataSuccessfulQuery = {
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
