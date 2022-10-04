import React, { FC } from 'react';

import { VerticalGroup } from '@grafana/ui';
import { EmotionPerfTest } from '@grafana/ui/src/components/ThemeDemos/EmotionPerfTest';

export const BenchmarksPage: FC = () => {
  return (
    <VerticalGroup>
      <EmotionPerfTest />
    </VerticalGroup>
  );
};

export default BenchmarksPage;
