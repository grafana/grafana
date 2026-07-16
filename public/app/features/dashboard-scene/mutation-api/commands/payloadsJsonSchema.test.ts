import { z } from 'zod';

import { payloads } from './schemas';

// Locks the JSON Schema emitted for every mutation command payload — the exact
// surface (fields, defaults, and `.describe()` guidance) that LLM tool consumers
// see via `getPayloadSchema()`. Any change to `schemas.ts` that would alter a
// command's tool contract must update this snapshot deliberately.
describe('mutation command payloads — JSON Schema contract', () => {
  it.each(Object.keys(payloads))('%s payload JSON Schema is stable', (name) => {
    const schema = payloads[name as keyof typeof payloads];
    const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any' });
    expect(jsonSchema).toMatchSnapshot();
  });
});
