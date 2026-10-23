import { useIsStPodLoading } from 'app/core/navigation/useIsStPodLoading';

import { StPodPendingDots } from './StPodPendingDots';

export const StPodPendingEllipsis = ({ url, itemName }: { url: string; itemName?: string }) => {
  const isLoading = useIsStPodLoading(url);

  if (!isLoading) {
    return null;
  }

  return <StPodPendingDots itemName={itemName} />;
};
