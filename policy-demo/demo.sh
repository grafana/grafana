#!/usr/bin/env bash
# Walks through the validation policy demo with gcx. See README.md for what each step shows.
#
# Usage:
#   ./demo.sh                 run the demo, pausing between steps when attached to a terminal
#   ./demo.sh cleanup         delete everything the demo creates
#
# Environment:
#   GCX_CONTEXT   gcx context to use (default: the current context)
#   GCX_CONFIG    gcx config file to use (default: gcx's normal config layering)
#   DEMO_PAUSE    1 to pause between steps, 0 not to (default: 1 when stdin is a terminal)
#   DEMO_WAIT     seconds to wait for the apps to write their policies (default: 30)

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EX="$DIR/examples"
WAIT="${DEMO_WAIT:-30}"
if [[ -z "${DEMO_PAUSE:-}" ]]; then
  if [[ -t 0 ]]; then DEMO_PAUSE=1; else DEMO_PAUSE=0; fi
fi

GCX=(gcx --no-color)
[[ -n "${GCX_CONFIG:-}" ]] && GCX+=(--config "$GCX_CONFIG")
[[ -n "${GCX_CONTEXT:-}" ]] && GCX+=(--context "$GCX_CONTEXT")

POLICIES=validationpolicies.v0alpha1.policy.grafana.app
BINDINGS=validationpolicybindings.v0alpha1.policy.grafana.app

bold=$'\e[1m'; dim=$'\e[2m'; green=$'\e[32m'; red=$'\e[31m'; yellow=$'\e[33m'; reset=$'\e[0m'
[[ -t 1 ]] || { bold=; dim=; green=; red=; yellow=; reset=; }

mismatches=0

section() { printf '\n%s==> %s%s\n' "$bold" "$1" "$reset"; }
say() { printf '%s\n' "$@"; }

pause() {
  if [[ "$DEMO_PAUSE" == 1 ]]; then
    read -r -p "${dim}Press enter to continue...${reset}" _ </dev/tty
  fi
  return 0
}

# push FILE EXPECTATION applies one example and checks the outcome.
# EXPECTATION is one of: accepted, warned, denied.
push() {
  local file="$1" expect="$2" raw out warnings status=0 got
  printf '\n%s$ gcx resources push -p %s%s\n' "$dim" "${file#"$DIR"/}" "$reset"
  # gcx only logs the API server's warnings at -vvv, so push at that level and keep just the
  # warnings and gcx's own result lines.
  raw="$("${GCX[@]}" -vvv resources push -p "$file" --on-error abort -o text 2>&1)" || status=$?
  warnings="$(grep -E '^INFO Warning: ' <<<"$raw" | sed 's/^INFO //' || true)"
  out="$(grep -vE '^(TRACE|DEBUG|INFO|WARN)[ +]' <<<"$raw" || true)"
  [[ -n "$warnings" ]] && printf '%s%s%s\n' "$yellow" "$warnings" "$reset" | sed 's/^/    /'
  printf '%s\n' "$out" | sed 's/^/    /'

  if [[ $status -ne 0 ]]; then
    got=denied
  elif [[ -n "$warnings" ]]; then
    got=warned
  else
    got=accepted
  fi
  if [[ "$got" == "$expect" ]]; then
    printf '  %s✔ %s, as expected%s\n' "$green" "$got" "$reset"
  else
    printf '  %s✘ expected %s, got %s%s\n' "$red" "$expect" "$got" "$reset"
    mismatches=$((mismatches + 1))
  fi
}

# wait_for_binding NAME waits until an app's reconciler has written the named binding. The
# admission hook enforces a binding as soon as its watch sees it, which follows within moments.
wait_for_binding() {
  local name="$1" deadline=$((SECONDS + WAIT))
  printf '%s  waiting for binding %s...%s' "$dim" "$name" "$reset"
  until "${GCX[@]}" resources get "$BINDINGS/$name" -o json >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then
      printf '\n  %s✘ binding %s did not appear within %ss%s\n' "$red" "$name" "$WAIT" "$reset"
      exit 1
    fi
    sleep 1
  done
  sleep 2
  printf ' %sready%s\n' "$green" "$reset"
}

cleanup() {
  section "Cleaning up"
  # Rules first, so their folder can be deleted; policies last, so their apps remove the
  # validation policies and bindings they wrote.
  local dirs=(03-alert-rules 02-folders 00-before-policies 01-policies)
  for d in "${dirs[@]}"; do
    "${GCX[@]}" resources delete -p "$EX/$d" --yes --on-error ignore -o text >/dev/null 2>&1 || true
  done
  say "Deleted the demo's alert rules, folders and policies."
}

check_apis() {
  local missing=0 group types
  # Captured once rather than piped into grep -q, which would end gcx early with SIGPIPE and,
  # under pipefail, report a served API as missing.
  types="$("${GCX[@]}" resources list-types -o json 2>/dev/null || true)"
  for group in policy.grafana.app rulepolicy.alerting.grafana.app foldernaming.grafana.app; do
    if ! grep -q "\"$group\"" <<<"$types"; then
      say "${red}The $group API is not served by this Grafana.${reset}"
      missing=1
    fi
  done
  if [[ $missing -ne 0 ]]; then
    say "Enable the policy APIs with the [grafana-apiserver] runtime_config in policy-demo/grafana.ini, then restart Grafana."
    exit 1
  fi
}

if [[ "${1:-}" == cleanup ]]; then
  cleanup
  exit 0
fi

check_apis
# Start from a clean slate. Resources are left in place at the end so they can be shown in the UI.
cleanup >/dev/null

section "1. Before any policy exists"
say "A folder created now does not follow the naming conventions that are introduced next."
push "$EX/00-before-policies/legacy-folder.yaml" accepted
pause

section "2. Admins describe what they want, in the apps' own terms"
say "Two RulePolicies (one enforced, one advisory) and two FolderNamingPolicies (one enforced,"
say "one advisory). None of them contains CEL: each app's reconciler turns them into a"
say "ValidationPolicy and a ValidationPolicyBinding."
push "$EX/01-policies/rule-policy-ownership.yaml" accepted
push "$EX/01-policies/rule-policy-documentation.yaml" accepted
push "$EX/01-policies/folder-naming-team-prefix.yaml" accepted
push "$EX/01-policies/folder-naming-length.yaml" accepted
wait_for_binding rulepolicy-ownership
wait_for_binding rulepolicy-documentation
wait_for_binding foldernaming-team-prefix
wait_for_binding foldernaming-short-titles
pause

section "3. What the apps generated"
say "One policy and one binding per app resource. The binding's action comes from enforcement,"
say "and its paramRef points back at the RulePolicy or FolderNamingPolicy, which supplies the keys"
say "or pattern to the policy's expressions at evaluation time."
printf '\n%s$ gcx resources get %s%s\n' "$dim" "$BINDINGS" "$reset"
"${GCX[@]}" resources get "$BINDINGS" -o yaml 2>/dev/null |
  grep -E '^\s*(name|policyName|actions|- (Deny|Warn)|paramRef):?' | sed 's/^/    /' || true
printf '\n%s$ gcx resources get %s/rulepolicy-ownership -o yaml%s\n' "$dim" "$POLICIES" "$reset"
"${GCX[@]}" resources get "$POLICIES/rulepolicy-ownership" -o yaml 2>/dev/null | sed -n '/^spec:/,$p' | sed 's/^/    /' || true
pause

section "4. Folders"
push "$EX/02-folders/compliant-folder.yaml" accepted
push "$EX/02-folders/denied-no-team-prefix.yaml" denied
push "$EX/02-folders/warned-long-title.yaml" warned
say ""
say "The legacy folder can still be edited, but not renamed to another non-compliant title."
push "$EX/02-folders/legacy-folder-updated.yaml" accepted
push "$EX/02-folders/denied-legacy-rename.yaml" denied
push "$EX/02-folders/legacy-rename.yaml" accepted
pause

section "5. Alert rules"
push "$EX/03-alert-rules/compliant-rule.yaml" accepted
push "$EX/03-alert-rules/denied-missing-ownership.yaml" denied
push "$EX/03-alert-rules/denied-forbidden-label.yaml" denied
push "$EX/03-alert-rules/warned-undocumented.yaml" warned
pause

section "6. Guardrails on the policies themselves"
push "$EX/04-guardrails/denied-handwritten-validation-policy.yaml" denied
push "$EX/04-guardrails/denied-conflicting-rule-policy.yaml" denied
push "$EX/04-guardrails/denied-invalid-folder-pattern.yaml" denied
pause

section "Summary"
say "The demo's resources are still in place. Remove them with: $0 cleanup"
if [[ $mismatches -eq 0 ]]; then
  say "${green}Every step behaved as expected.${reset}"
else
  say "${yellow}$mismatches step(s) did not behave as expected; see the ✘ marks above.${reset}"
  exit 1
fi
