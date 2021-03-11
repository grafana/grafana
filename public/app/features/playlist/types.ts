export interface PlaylistDTO {
  id: number;
  name: string;
  startUrl?: string;
}

export interface PlayListItemDTO {
  id: number;
  title: string;
  playlistid: string;
  type: 'dashboard' | 'tag';
}
