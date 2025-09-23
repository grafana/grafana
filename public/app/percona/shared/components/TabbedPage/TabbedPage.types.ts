import { PageProps } from 'app/core/components/Page/types';

export interface TabbedPageProps extends PageProps {
  vertical?: boolean;
  isLoading?: boolean;
}
