//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  showStarred: boolean;
  showRecentlyViewed: boolean;
  showSearch: boolean;
  showHeadings: boolean;
  maxItems: number;
  query?: string;
  folderId?: number;
  tags: string[];
}

export const defaultPanelOptions: PanelOptions = {
  showStarred: true,
  showRecentlyViewed: false,
  showSearch: false,
  showHeadings: true,
  maxItems: 10,
  query: '',
  tags: [],
};
