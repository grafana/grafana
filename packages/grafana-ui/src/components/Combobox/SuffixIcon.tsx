import { Icon } from '../Icon/Icon';

interface Props {
  isLoading: boolean;
  isOpen: boolean;
}

export const SuffixIcon = ({ isLoading, isOpen }: Props) => {
  const suffixIcon = isLoading
    ? 'spinner'
    : // If it's loading, show loading icon. Otherwise, icon indicating menu state
      isOpen
      ? 'search'
      : 'angle-down';

  return <Icon name={suffixIcon} />;
};
