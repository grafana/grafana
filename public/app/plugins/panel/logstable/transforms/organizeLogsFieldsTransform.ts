export const organizeLogsFieldsTransform = (
  indexByName: Record<string, number>,
  includeByName: Record<string, boolean>
) => {
  return [
    {
      id: 'organize',
      options: {
        indexByName,
        includeByName,
      },
    },
  ];
};
