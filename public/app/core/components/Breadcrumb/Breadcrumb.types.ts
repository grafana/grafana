export interface PageModel {
  title: string;
  path: string;
  id: string;
  children?: PageModel[];
  component?: React.ReactNode;
}

export interface BreadcrumbProps {
  pageModel: PageModel;
  currentLocation: string;
}
