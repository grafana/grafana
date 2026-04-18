#!/usr/bin/env bash
#
# Sets up the "Black Friday war room" demo for dashboard rules:
#   1. Creates users: sre-user, product-user, business-user
#   2. Creates teams: platform-sre, product-eng, business
#   3. Adds users to their respective teams (admin to all teams)
#   4. Imports the demo dashboard via the v3alpha0 k8s-style API
#
# With --rules flag, also patches the dashboard with 6 pre-configured rules
# (3 row-level team visibility + 3 tab-level team/time-range visibility).
#
# Prerequisites:
#   - Grafana running on localhost:3000 with admin:admin credentials
#   - dashboardRules and dashboardNewLayouts feature toggles enabled
#
# Usage:
#   ./setup-demo.sh          # create users, teams, dashboard
#   ./setup-demo.sh --rules  # also add rules to the dashboard

set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"
AUTH="${ADMIN_USER}:${ADMIN_PASS}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_FILE="${SCRIPT_DIR}/demo-dashboard.json"
DASH_NAME="war-room-black-friday"
APPLY_RULES=false

for arg in "$@"; do
  case "${arg}" in
    --rules) APPLY_RULES=true ;;
  esac
done

echo "=== Dashboard rules demo setup ==="
echo "Grafana: ${GRAFANA_URL}"
echo "Apply rules: ${APPLY_RULES}"
echo ""

# ---------------------------------------------------------------
# Helper: call Grafana API with basic auth
# ---------------------------------------------------------------
api() {
  local method="$1" path="$2"
  shift 2
  curl -s -X "${method}" \
    -H "Content-Type: application/json" \
    -u "${AUTH}" \
    "${GRAFANA_URL}${path}" "$@"
}

# ---------------------------------------------------------------
# 1. Create users
# ---------------------------------------------------------------
echo "--- Creating users ---"

create_user() {
  local login="$1" name="$2" password="$3"
  local result
  result=$(api POST /api/admin/users -d "{
    \"name\": \"${name}\",
    \"login\": \"${login}\",
    \"password\": \"${password}\",
    \"OrgId\": 1
  }")
  local id
  id=$(echo "${result}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
  if [ -n "${id}" ] && [ "${id}" != "" ]; then
    echo "  Created user '${login}' (id: ${id})"
  else
    echo "  User '${login}' already exists"
    id=$(api GET "/api/users/lookup?loginOrEmail=${login}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  fi
  echo "${id}"
}

ADMIN_ID=$(api GET "/api/users/lookup?loginOrEmail=admin" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Admin user id: ${ADMIN_ID}"

SRE_ID=$(create_user "sre-user" "SRE Engineer" "password")
SRE_ID=$(echo "${SRE_ID}" | tail -1)

PRODUCT_ID=$(create_user "product-user" "Product Engineer" "password")
PRODUCT_ID=$(echo "${PRODUCT_ID}" | tail -1)

BUSINESS_ID=$(create_user "business-user" "Business Analyst" "password")
BUSINESS_ID=$(echo "${BUSINESS_ID}" | tail -1)

# Ensure all demo users have Viewer role in org 1
echo "  Setting org roles..."
for uid in "${SRE_ID}" "${PRODUCT_ID}" "${BUSINESS_ID}"; do
  api PATCH "/api/orgs/1/users/${uid}" -d "{\"role\": \"Viewer\"}" > /dev/null 2>&1 || true
done
echo "  All users have Viewer role in org 1"

echo ""

# ---------------------------------------------------------------
# 2. Create teams and capture UIDs
# ---------------------------------------------------------------
echo "--- Creating teams ---"

create_team() {
  local name="$1"
  local result
  result=$(api POST /api/teams -d "{\"name\": \"${name}\"}")
  local id
  id=$(echo "${result}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('teamId',''))" 2>/dev/null || true)
  if [ -z "${id}" ] || [ "${id}" = "" ]; then
    echo "  Team '${name}' already exists" >&2
    id=$(api GET "/api/teams/search?name=${name}" | python3 -c "import sys,json; teams=json.load(sys.stdin).get('teams',[]); print(teams[0]['id'] if teams else '')" 2>/dev/null || true)
  else
    echo "  Created team '${name}' (id: ${id})" >&2
  fi
  echo "${id}"
}

get_team_uid() {
  local team_id="$1"
  api GET "/api/teams/${team_id}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null || true
}

SRE_TEAM=$(create_team "platform-sre")
SRE_TEAM=$(echo "${SRE_TEAM}" | tail -1)
SRE_TEAM_UID=$(get_team_uid "${SRE_TEAM}")
echo "  platform-sre: id=${SRE_TEAM}, uid=${SRE_TEAM_UID}"

PRODUCT_TEAM=$(create_team "product-eng")
PRODUCT_TEAM=$(echo "${PRODUCT_TEAM}" | tail -1)
PRODUCT_TEAM_UID=$(get_team_uid "${PRODUCT_TEAM}")
echo "  product-eng: id=${PRODUCT_TEAM}, uid=${PRODUCT_TEAM_UID}"

BUSINESS_TEAM=$(create_team "business")
BUSINESS_TEAM=$(echo "${BUSINESS_TEAM}" | tail -1)
BUSINESS_TEAM_UID=$(get_team_uid "${BUSINESS_TEAM}")
echo "  business: id=${BUSINESS_TEAM}, uid=${BUSINESS_TEAM_UID}"

echo ""

# ---------------------------------------------------------------
# 3. Add users to teams
# ---------------------------------------------------------------
echo "--- Adding users to teams ---"

add_member() {
  local team_id="$1" user_id="$2" team_name="$3" user_name="$4"
  local result
  result=$(api POST "/api/teams/${team_id}/members" -d "{\"userId\": ${user_id}}")
  echo "  ${user_name} -> ${team_name}: ${result}"
}

add_member "${SRE_TEAM}" "${ADMIN_ID}" "platform-sre" "admin"
add_member "${PRODUCT_TEAM}" "${ADMIN_ID}" "product-eng" "admin"
add_member "${BUSINESS_TEAM}" "${ADMIN_ID}" "business" "admin"

add_member "${SRE_TEAM}" "${SRE_ID}" "platform-sre" "sre-user"
add_member "${PRODUCT_TEAM}" "${PRODUCT_ID}" "product-eng" "product-user"
add_member "${BUSINESS_TEAM}" "${BUSINESS_ID}" "business" "business-user"

echo ""

# ---------------------------------------------------------------
# 4. Create folder and import demo dashboard (v3alpha0 API)
# ---------------------------------------------------------------
FOLDER_UID="demo-rules"
FOLDER_TITLE="Dashboard rules demo"

echo "--- Creating folder ---"
FOLDER_RESULT=$(api POST /api/folders -d "{\"uid\": \"${FOLDER_UID}\", \"title\": \"${FOLDER_TITLE}\"}")
FOLDER_OK=$(echo "${FOLDER_RESULT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uid',''))" 2>/dev/null || true)
if [ -n "${FOLDER_OK}" ]; then
  echo "  Created folder '${FOLDER_TITLE}' (uid: ${FOLDER_UID})"
else
  echo "  Folder '${FOLDER_TITLE}' already exists"
fi

echo "--- Importing demo dashboard ---"

if [ ! -f "${DASHBOARD_FILE}" ]; then
  echo "  ERROR: ${DASHBOARD_FILE} not found"
  exit 1
fi

DASH_API="${GRAFANA_URL}/apis/dashboard.grafana.app/v3alpha0/namespaces/default/dashboards"

# Inject folder annotation into the dashboard JSON before import
DASH_WITH_FOLDER=$(python3 -c "
import json, sys
with open('${DASHBOARD_FILE}') as f:
    d = json.load(f)
if 'annotations' not in d['metadata']:
    d['metadata']['annotations'] = {}
d['metadata']['annotations']['grafana.app/folder'] = '${FOLDER_UID}'
json.dump(d, sys.stdout)
")

DASH_RESULT=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -u "${AUTH}" \
  "${DASH_API}" \
  -d "${DASH_WITH_FOLDER}")

CREATED_NAME=$(echo "${DASH_RESULT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('name',''))" 2>/dev/null || true)

if [ -n "${CREATED_NAME}" ]; then
  echo "  Dashboard created: ${CREATED_NAME}"
  echo "  URL: ${GRAFANA_URL}/d/${CREATED_NAME}"
else
  echo "  Dashboard already exists, updating..."
  EXISTING=$(curl -s -u "${AUTH}" "${DASH_API}/${DASH_NAME}")
  RV=$(echo "${EXISTING}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('resourceVersion',''))" 2>/dev/null || true)

  if [ -n "${RV}" ]; then
    UPDATED_JSON=$(python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
d['metadata']['resourceVersion'] = '${RV}'
if 'annotations' not in d['metadata']:
    d['metadata']['annotations'] = {}
d['metadata']['annotations']['grafana.app/folder'] = '${FOLDER_UID}'
json.dump(d, sys.stdout)
" <<< "${DASH_WITH_FOLDER}")
    curl -s -X PUT \
      -H "Content-Type: application/json" \
      -u "${AUTH}" \
      "${DASH_API}/${DASH_NAME}" \
      -d "${UPDATED_JSON}" > /dev/null
    echo "  Dashboard updated: ${DASH_NAME}"
    echo "  URL: ${GRAFANA_URL}/d/${DASH_NAME}"
  else
    echo "  ERROR: Could not resolve dashboard"
    echo "  ${DASH_RESULT}"
    exit 1
  fi
fi

echo ""

# ---------------------------------------------------------------
# 5. Optionally patch the dashboard with rules (--rules)
# ---------------------------------------------------------------
if [ "${APPLY_RULES}" = true ]; then
  echo "--- Applying rules to dashboard ---"

  # Fetch the latest version of the dashboard (need resourceVersion for PUT)
  CURRENT=$(curl -s -u "${AUTH}" "${DASH_API}/${DASH_NAME}")
  CURRENT_RV=$(echo "${CURRENT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('resourceVersion',''))" 2>/dev/null)

  # Build the updated dashboard JSON with rules injected
  PATCHED=$(python3 -c "
import json, sys

current = json.loads('''$(echo "${CURRENT}" | python3 -c "import sys; print(sys.stdin.read().replace(\"'\", \"'\\\"'\\\"'\"))")''')

sre_uid = '${SRE_TEAM_UID}'
product_uid = '${PRODUCT_TEAM_UID}'
business_uid = '${BUSINESS_TEAM_UID}'

rules = [
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'sre-overview',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'row-sre-overview'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingUserTeam',
                    'spec': {'operator': 'is_not_member', 'teamUids': [sre_uid]}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'product-overview',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'row-product-overview'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingUserTeam',
                    'spec': {'operator': 'is_not_member', 'teamUids': [product_uid]}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'business-overview',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'row-business-overview'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingUserTeam',
                    'spec': {'operator': 'is_not_member', 'teamUids': [business_uid]}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'sre-infra-tab',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'tab-infrastructure'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingUserTeam',
                    'spec': {'operator': 'is_not_member', 'teamUids': [sre_uid]}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'product-tab',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'tab-checkout'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingUserTeam',
                    'spec': {'operator': 'is_not_member', 'teamUids': [product_uid]}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'deep-dive-hidden',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'tab-deep-dive'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '99999d'}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'hide'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'deep-dive-show',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'tab-deep-dive'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '1h'}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeVisibility', 'spec': {'visibility': 'show'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'fast-refresh',
            'targets': [],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '5m'}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeRefreshInterval', 'spec': {'interval': '5s'}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'collapse-infra-compute',
            'targets': [{'kind': 'LayoutItemReference', 'name': 'row-infra-compute'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '30m'}
                }]
            },
            'outcomes': [{'kind': 'DashboardRuleOutcomeCollapse', 'spec': {'collapse': True}}]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'override-request-rate-query',
            'targets': [{'kind': 'ElementReference', 'name': 'panel-request-rate'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '5m'}
                }]
            },
            'outcomes': [{
                'kind': 'DashboardRuleOutcomeOverrideQuery',
                'spec': {
                    'queries': [{
                        'refId': 'A',
                        'scenarioId': 'simulation',
                        'sim': {
                            'key': {'type': 'sine', 'tick': 10},
                            'stream': True,
                            'config': {'amplitude': 50, 'offset': 800, 'period': 30}
                        },
                        'alias': 'request-rate (live)'
                    }]
                }
            }]
        }
    },
    {
        'kind': 'DashboardRule',
        'spec': {
            'name': 'override-latency-query',
            'targets': [{'kind': 'ElementReference', 'name': 'panel-p99-latency'}],
            'conditions': {
                'match': 'and',
                'items': [{
                    'kind': 'ConditionalRenderingTimeRangeSize',
                    'spec': {'value': '5m'}
                }]
            },
            'outcomes': [{
                'kind': 'DashboardRuleOutcomeOverrideQuery',
                'spec': {
                    'queries': [{
                        'refId': 'A',
                        'scenarioId': 'simulation',
                        'sim': {
                            'key': {'type': 'sine', 'tick': 10},
                            'stream': True,
                            'config': {
                                'amplitude': 100,
                                'offset': 200,
                                'period': 60
                            }
                        },
                        'alias': 'p99 (live)'
                    }]
                }
            }]
        }
    }
]

current['spec']['rules'] = rules
json.dump(current, sys.stdout)
")

  curl -s -X PUT \
    -H "Content-Type: application/json" \
    -u "${AUTH}" \
    "${DASH_API}/${DASH_NAME}" \
    -d "${PATCHED}" > /dev/null

  echo "  11 rules applied:"
  echo "    1. sre-overview:           hide 'SRE overview' row if not platform-sre"
  echo "    2. product-overview:       hide 'Checkout health' row if not product-eng"
  echo "    3. business-overview:      hide 'Business KPIs' row if not business"
  echo "    4. sre-infra-tab:          hide 'Infrastructure' tab if not platform-sre"
  echo "    5. product-tab:            hide 'Checkout & payments' tab if not product-eng"
  echo "    6. deep-dive-hidden:       hide 'Deep dive' tab (always, baseline)"
  echo "    7. deep-dive-show:         show 'Deep dive' tab when time range <= 1h (overrides #6)"
  echo "    8. fast-refresh:           set refresh to 5s when time range < 5m"
  echo "    9. collapse-infra-compute: collapse 'Compute & network' row when time range < 30m"
  echo "   10. override-request-rate:  swap 'Request rate' to live streaming when time range < 5m"
  echo "   11. override-latency:       swap 'P99 latency' to sine simulation when time range < 5m"
  echo ""
fi

echo "=== Setup complete ==="
echo ""
echo "Users (password: 'password' for all):"
echo "  - admin        (member of: platform-sre, product-eng, business)"
echo "  - sre-user     (member of: platform-sre)"
echo "  - product-user (member of: product-eng)"
echo "  - business-user (member of: business)"
echo ""
echo "Dashboard: ${GRAFANA_URL}/d/${DASH_NAME}"
if [ "${APPLY_RULES}" = false ]; then
  echo ""
  echo "Run with --rules to also configure the 11 demo rules:"
  echo "  ./setup-demo.sh --rules"
fi
