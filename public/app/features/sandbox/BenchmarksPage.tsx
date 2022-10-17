import React from 'react';

import { VerticalGroup } from '@grafana/ui';
import { EmotionPerfTest } from '@grafana/ui/src/components/ThemeDemos/EmotionPerfTest';

export const BenchmarksPage = () => {
  return (
    <VerticalGroup>
      <EmotionPerfTest />
    </VerticalGroup>
  );
};

export default BenchmarksPage;
