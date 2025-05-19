export const newResultsMock = (refId: string, fields: Field[], options: string[]) => {
  return {
    [refId]: {
      status: 200,
      frames: [
        {
          schema: {
            refId,
            fields,
          },
          data: {
            values: [options],
          },
        },
      ],
    },
  };
};

export const newStringField = (name: string, options: string[]) => {
  return {
    name,
    type: 'string',
    typeInfo: {
      frame: 'string',
      nullable: true,
    },
    values: options,
  };
};

type Field = {
  name: string;
  type: string;
  typeInfo: {
    frame: string;
    nullable: boolean;
  };
  values: string[];
};
