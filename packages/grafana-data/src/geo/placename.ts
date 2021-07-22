export interface PlacenameInfo {
  point: [number, number];
}

export interface PlacenameLookup {
  find: (key: string) => PlacenameInfo;
}
