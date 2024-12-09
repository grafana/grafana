import { css } from '@emotion/css';

import { Spinner } from '@grafana/ui';

// ideally we'd use `@grafana/ui/LoadingPlaceholder`, but that
// one has a large margin-bottom.
type Props = {
  adjective?: string;
};

export const LoadingIndicator = ({ adjective = 'newer' }: Props) => {
  const text = `Loading ${adjective} logs...`;
  return (
    <div className={loadingIndicatorStyles}>
      <div>
        {text} <Spinner inline />
      </div>
    </div>
  );
};

const loadingIndicatorStyles = css({
  display: 'flex',
  justifyContent: 'center',
});
