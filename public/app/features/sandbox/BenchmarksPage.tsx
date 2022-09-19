import React from 'react';

import { EmotionPerfTest, VerticalGroup } from '@grafana/ui';

export const BenchmarksPage = () => {
  return (
    <VerticalGroup>
      <EmotionPerfTest />
    </VerticalGroup>
  );
};

export default BenchmarksPage;
