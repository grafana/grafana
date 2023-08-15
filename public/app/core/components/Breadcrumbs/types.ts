import { IconName } from '@grafana/ui';

interface TextBreadcrumb {
  text: string;
  href: string;
  // allow for an onClick handler to override href action
  onClick?: () => void;
}

interface IconBreadcrumb extends TextBreadcrumb {
  icon: IconName;
}

export type Breadcrumb = TextBreadcrumb | IconBreadcrumb;
