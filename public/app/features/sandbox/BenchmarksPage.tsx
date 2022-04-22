import React, { FC } from 'react';

import { EmotionPerfTest, VerticalGroup } from '@grafana/ui';

export const BenchmarksPage: FC = () => {
  return (
    <VerticalGroup>
      <EmotionPerfTest />
    </VerticalGroup>
  );
};

export default BenchmarksPage;
