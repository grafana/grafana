/**
 * Contract fixture for RENDER_PLAN, shared in spirit (not by import -- the assistant repo cannot
 * import core's zod schemas) with the assistant's own mapper test.
 *
 * This is the payload shape the assistant's plan-to-RENDER_PLAN mapper produces. Core asserts
 * this fixture is accepted and renders correctly (see renderPlan.test.ts); the assistant repo
 * asserts its mapper produces exactly this object. Keep the two literal objects in sync by hand
 * -- a shape change on either side needs a matching update on both.
 *
 * Assistant-side fixture: apps/plugin/src/features/dashboarding/renderPlanContractFixture.ts
 * (or wherever the assistant places its half -- check there before changing this shape).
 */
export const renderPlanContractFixture = {
  planId: 'plan-1',
  title: 'Kafka cluster overview',
  description: 'Broker throughput, consumer lag, and error rates for the production cluster.',
  layout: 'rows' as const,
  sections: [
    {
      title: 'Throughput',
      panels: [
        { title: 'Messages in/sec', vizType: 'timeseries' },
        { title: 'Bytes in/sec', vizType: 'timeseries' },
      ],
    },
    {
      title: 'Consumer health',
      panels: [
        { title: 'Consumer lag', vizType: 'timeseries' },
        { title: 'Error rate', vizType: 'stat' },
      ],
    },
  ],
  variables: ['cluster', 'topic'],
};
