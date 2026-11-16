import { withPageErrorBoundary } from '../withPageErrorBoundary';

import RevampedHome from './revamped/RevampedHome';

// Testing-only branch for an ephemeral Cloud instance: the revamped home page replaces the
// current one, with no feature toggle. Do not merge.
function Home() {
  return <RevampedHome />;
}

export default withPageErrorBoundary(Home);
