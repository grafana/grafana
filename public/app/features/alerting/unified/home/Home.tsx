import { useFlagAlertingRevampedHomeExperience } from '@grafana/runtime/internal';

import { withPageErrorBoundary } from '../withPageErrorBoundary';

import LegacyHome from './LegacyHome';
import RevampedHome from './revamped/RevampedHome';

function Home() {
  const revampedHomeEnabled = useFlagAlertingRevampedHomeExperience();

  return revampedHomeEnabled ? <RevampedHome /> : <LegacyHome />;
}

export default withPageErrorBoundary(Home);
