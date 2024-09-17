import { IconName } from '@grafana/ui';

export interface Card {
  title: string;
  type: 'docs' | 'other';
  icon: IconName;
  href: string;
  check: () => Promise<boolean>;
  done: boolean;
  heading: string;
  learnHref?: string;
}

export interface TutorialCardType extends Omit<Card, 'type'> {
  info?: string;
  type: 'tutorial';
  // For local storage
  key: string;
}

export interface SetupStep {
  heading: string;
  subheading: string;
  title: string;
  info: string;
  cards: Array<Card | TutorialCardType>;
  done: boolean;
}
