export type CardType = 'help';

export interface Description {
  doc: string;
  video: string;
  community: string;
}

export interface Card {
  id: keyof Description;
  type: CardType;
  heading: string;
  info: string;
  icon?: string;
  iconWidth?: number;
  iconHeight?: number;
  href?: string;
}

export interface Options {
  descr: Description;
}
