import { css } from '@emotion/css';
import React from 'react';

import { Spinner } from '@grafana/ui';

import { Place } from './types';

// ideally we'd use `@grafana/ui/LoadingPlaceholder`, but that
// one has a large margin-bottom.

type Props = {
  place: Place;
};

export const LoadingIndicator = ({ place }: Props) => {
  const text = place === 'above' ? 'Loading newer logs...' : 'Loading older logs...';
  return (
    <div className={loadingIndicatorStyles}>
      <div>
        {text} <Spinner inline />
      </div>
    </div>
  );
};

const loadingIndicatorStyles = css`
  display: flex;
  justify-content: center;
`;
