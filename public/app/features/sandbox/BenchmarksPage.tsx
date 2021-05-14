import { EmotionPerfTest, VerticalGroup } from '@grafana/ui';
import React, { FC } from 'react';

export const BenchmarksPage: FC = () => {
  return (
    <VerticalGroup>
      <EmotionPerfTest />
    </VerticalGroup>
  );
};

export default BenchmarksPage;
