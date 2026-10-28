import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';

import { LegacyHomePage } from './LegacyHomePage';
import { RedesignedHomePage } from './RedesignedHomePage';

export default function HomePage() {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();

  return redesignEnabled ? <RedesignedHomePage /> : <LegacyHomePage />;
}
