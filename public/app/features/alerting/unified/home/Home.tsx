import { withPageErrorBoundary } from '../withPageErrorBoundary';

import RevampedHome from './revamped/RevampedHome';

// Testing-only branch for an ephemeral Cloud instance: always render the revamped home page,
// whatever alerting.revampedHomeExperience says. Do not merge.
function Home() {
  return <RevampedHome />;
}

export default withPageErrorBoundary(Home);
