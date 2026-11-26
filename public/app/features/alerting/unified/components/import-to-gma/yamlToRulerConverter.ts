import { DEFAULT_SCHEMA, Type, load } from 'js-yaml';
import * as z from 'zod/mini';

import { type RulerCloudRuleDTO, type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

// An unquoted date would load as a Date and be sent as a full ISO timestamp.
// A type with the same tag replaces the default one, so the value stays the text the user wrote.
const timestampAsString = new Type('tag:yaml.org,2002:timestamp', { kind: 'scalar', resolve: () => false });
const YAML_SCHEMA = DEFAULT_SCHEMA.extend({ implicit: [timestampAsString] });

// The fields below are typed the way the backend decodes them (PrometheusRuleGroup, PrometheusRule),
// so a file the backend would reject fails in the file step and not when the import is submitted.
const nonEmptyString = z.string().check(z.minLength(1));
// Same grammar as the backend's model.ParseDuration: descending units, each at most once.
const DURATION_UNITS = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/;
const prometheusDuration = z
  .string()
  .check(
    z.refine(
      (value) => value === '0' || (value !== '' && DURATION_UNITS.test(value)),
      'must be a Prometheus duration, for example 5m or 1h30m'
    )
  );
// The backend decodes a null value as an empty string, so a null is not an error.
const stringMap = z.record(z.string(), z.nullable(z.string()));

function nullValuesToEmptyStrings(map: z.infer<typeof stringMap> | null | undefined) {
  return map ? Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value ?? ''])) : undefined;
}

// Loose objects keep keys the backend ignores instead of stripping them.
const ruleSchema = z.pipe(
  z.looseObject({
    alert: z.nullish(z.string()),
    record: z.nullish(z.string()),
    expr: nonEmptyString,
    for: z.nullish(prometheusDuration),
    keep_firing_for: z.nullish(prometheusDuration),
    labels: z.nullish(stringMap),
    annotations: z.nullish(stringMap),
  }),
  z.transform(
    ({ alert, record, for: pendingPeriod, keep_firing_for, labels, annotations, ...rest }, ctx): RulerCloudRuleDTO => {
      const rule = {
        ...rest,
        for: pendingPeriod ?? undefined,
        keep_firing_for: keep_firing_for ?? undefined,
        labels: nullValuesToEmptyStrings(labels),
        annotations: nullValuesToEmptyStrings(annotations),
      };
      if (alert && !record) {
        return { ...rule, alert };
      }
      if (record && !alert) {
        return { ...rule, record };
      }
      ctx.issues.push({
        code: 'custom',
        message: 'a rule needs either an alert or a record name, not both',
        input: rest,
      });
      return z.NEVER;
    }
  )
);

const groupSchema = z.looseObject({
  name: nonEmptyString,
  // The backend rejects a null interval, so it stays optional only.
  interval: z.optional(prometheusDuration),
  query_offset: z.nullish(prometheusDuration),
  limit: z.nullish(z.literal(0, 'limit is not supported')),
  labels: z.nullish(stringMap),
  rules: z.array(ruleSchema),
});

const prometheusYamlFileSchema = z.object({
  namespace: z.optional(z.string()),
  groups: z.array(groupSchema),
});

const MAX_REPORTED_ISSUES = 10;

function toErrorMessage({ issues }: z.core.$ZodError): string {
  const message = z.prettifyError({ issues: issues.slice(0, MAX_REPORTED_ISSUES) });
  const hidden = issues.length - MAX_REPORTED_ISSUES;
  return hidden > 0 ? `${message}\n…and ${hidden} more` : message;
}

// only use this function directly for testing purposes, use parseYamlFileToRulerRulesConfigDTO instead
export function parseYamlToRulerRulesConfigDTO(
  yamlAsString: string,
  defaultNamespace: string
): RulerCloudRulesConfigDTO {
  const result = prometheusYamlFileSchema.safeParse(load(yamlAsString, { schema: YAML_SCHEMA }));

  if (!result.success) {
    throw new Error(toErrorMessage(result.error));
  }

  const { namespace = defaultNamespace, groups } = result.data;

  return { [namespace]: groups };
}

export async function parseYamlFileToRulerRulesConfigDTO(
  file: File,
  defaultNamespace: string
): Promise<RulerCloudRulesConfigDTO> {
  const yamlContent = await file.text();
  return parseYamlToRulerRulesConfigDTO(yamlContent, defaultNamespace);
}
