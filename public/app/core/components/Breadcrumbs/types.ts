import { type IconName } from '@grafana/ui';

interface TextBreadcrumb {
  text: string;
  /** Where the breadcrumb links to. Without it the breadcrumb is plain text. */
  href?: string;
  /** Short status label shown next to the text, for example "Draft". */
  highlightText?: string;
}

interface IconBreadcrumb extends TextBreadcrumb {
  icon: IconName;
}

export type Breadcrumb = TextBreadcrumb | IconBreadcrumb;
