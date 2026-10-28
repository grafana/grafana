import { type IconName } from '@grafana/ui';

interface TextBreadcrumb {
  text: string;
  href: string;
  /** Short status label shown next to the text, for example "Draft". */
  highlightText?: string;
}

interface IconBreadcrumb extends TextBreadcrumb {
  icon: IconName;
}

export type Breadcrumb = TextBreadcrumb | IconBreadcrumb;
