import { load } from 'js-yaml';
import * as z from 'zod/mini';

import {
  type RulerCloudRuleDTO,
  type RulerCloudRulesConfigDTO,
  type RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

const GROUPS_ERROR = 'Invalid YAML format: missing or invalid groups array';
const NAMESPACE_ERROR = 'Invalid YAML format: namespace must be a string';

const nonEmptyString = z.string().check(z.minLength(1));
// Arrays pass too: the guards this schema replaced accepted anything non-null of type 'object'.
const objectLike = z.custom<object>((value) => typeof value === 'object' && value !== null);

// Loose objects keep keys we don't validate (interval, keep_firing_for, ...) instead of stripping them.
const ruleSchema = z
  .looseObject({
    expr: nonEmptyString,
    for: z.optional(z.string()),
    labels: z.optional(objectLike),
    annotations: z.optional(objectLike),
  })
  // alert and record are left untyped: a non-string or empty one counts as absent, as before.
  .check(z.refine((rule) => isNonEmptyString(rule.alert) !== isNonEmptyString(rule.record)));

const prometheusYamlFileSchema = z.object({
  namespace: z.optional(z.string()),
  groups: z.array(z.looseObject({ name: nonEmptyString, rules: z.array(ruleSchema) })),
});

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value !== '';
}

function toErrorMessage(issues: z.core.$ZodIssue[]): string {
  const hasStructuralIssue = issues.some(
    ({ path }) => path.length === 0 || (path[0] === 'groups' && path.length === 1)
  );
  if (hasStructuralIssue) {
    return GROUPS_ERROR;
  }
  if (issues.some(({ path }) => path[0] === 'namespace')) {
    return NAMESPACE_ERROR;
  }
  // The message names the group, not the rule: the first issue belongs to the first invalid group.
  return `${GROUPS_ERROR} at index ${String(issues[0].path[1])}`;
}

// only use this function directly for testing purposes, use parseYamlFileToRulerRulesConfigDTO instead
export function parseYamlToRulerRulesConfigDTO(
  yamlAsString: string,
  defaultNamespace: string
): RulerCloudRulesConfigDTO {
  const result = prometheusYamlFileSchema.safeParse(load(yamlAsString));

  if (!result.success) {
    throw new Error(toErrorMessage(result.error.issues));
  }

  const { namespace = defaultNamespace, groups } = result.data;

  // The schema can't express the alert/record union, so the validated shape is asserted to the DTO type.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { [namespace]: groups as unknown as Array<RulerRuleGroupDTO<RulerCloudRuleDTO>> };
}

export async function parseYamlFileToRulerRulesConfigDTO(
  file: File,
  defaultNamespace: string
): Promise<RulerCloudRulesConfigDTO> {
  const yamlContent = await file.text();
  return parseYamlToRulerRulesConfigDTO(yamlContent, defaultNamespace);
}
