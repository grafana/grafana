import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'skip test',
  itName: 'skip test',
  skipScenario: true,
});
