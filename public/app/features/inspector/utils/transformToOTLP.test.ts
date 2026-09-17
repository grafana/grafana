// This is the one place allowed to import the exporter's runtime value. transformToOTLP.ts
// imports it as a type only, so the exporter's ~54 module runtime graph stays out of the app
// bundle; tests are not bundled, so importing it here is free.
import { collectorTypes } from '@opentelemetry/exporter-collector';

import { SpanKind } from './transformToOTLP';

describe('transformToOTLP SpanKind', () => {
  it('mirrors the exporter enum exactly', () => {
    // TypeScript numeric enums are two-way maps at runtime (name -> value and value -> name).
    // Keep only the forward direction so this compares like for like.
    const enumMembers = Object.fromEntries(
      Object.entries(collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind).filter(([key]) =>
        Number.isNaN(Number(key))
      )
    );

    // Fails if a member is added, removed, renamed or renumbered upstream.
    expect(SpanKind).toEqual(enumMembers);
  });
});
