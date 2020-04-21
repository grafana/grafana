import { IconName } from '@grafana/ui';

export type CardType = 'tutorial' | 'docs';

export interface Card {
  title: string;
  type: CardType;
  heading?: string;
  icon?: IconName;
  href: string;
  target?: string;
  info?: string;
  check: () => Promise<boolean>;
  done?: boolean;
}

export interface SetupStep {
  heading: string;
  subheading: string;
  title: string;
  info: string;
  cards: Card[];
}
