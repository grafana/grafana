export const getDisplayedFields = (
  displayedFields: string[] | undefined,
  timeFieldName: string,
  bodyFieldName: string
) => {
  return displayedFields?.length ? displayedFields : [timeFieldName, bodyFieldName];
};
