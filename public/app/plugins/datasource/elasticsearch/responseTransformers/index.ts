export const transformFieldsQueryResponse = (refId: string, res: any) => {
  if (!res.results?.[refId]?.tables) {
    return [];
  }

  return res.results[refId].tables[0].rows.map((row: any) => ({
    text: row[0],
    type: row[1],
  }));
};
