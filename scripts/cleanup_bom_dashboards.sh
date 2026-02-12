#!/bin/bash

# Script to clean up dashboards with BOM characters
# This script patches dashboards to trigger admission mutation which strips BOMs

set -e

NAMESPACE="${NAMESPACE:-default}"
DRY_RUN="${DRY_RUN:-true}"
LABEL_SELECTOR="${LABEL_SELECTOR:-}"

echo "==================================="
echo "Dashboard BOM Cleanup Script"
echo "==================================="
echo "Namespace: $NAMESPACE"
echo "Dry Run: $DRY_RUN"
echo "Label Selector: ${LABEL_SELECTOR:-all dashboards}"
echo ""

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo "ERROR: kubectl not found. Please install kubectl."
        exit 1
    fi
}

# Function to get all dashboard resources
get_dashboards() {
    local api_version=$1
    local kind=$2

    if [ -n "$LABEL_SELECTOR" ]; then
        kubectl get "$kind.$api_version" -n "$NAMESPACE" -l "$LABEL_SELECTOR" -o json
    else
        kubectl get "$kind.$api_version" -n "$NAMESPACE" -o json
    fi
}

# Function to check if a dashboard contains BOMs
contains_bom() {
    local dashboard_json=$1
    # Check if the JSON contains Unicode BOM character U+FEFF
    echo "$dashboard_json" | grep -q $'\xEF\xBB\xBF' && return 0
    echo "$dashboard_json" | grep -q $'\uFEFF' && return 0
    return 1
}

# Function to patch a dashboard to trigger cleanup
patch_dashboard() {
    local name=$1
    local api_version=$2
    local kind=$3

    echo "  Patching $kind/$name..."

    local patch='{
        "metadata": {
            "annotations": {
                "dashboard.grafana.app/bom-cleanup": "triggered-'$(date +%s)'"
            }
        }
    }'

    if [ "$DRY_RUN" = "true" ]; then
        echo "  [DRY RUN] Would patch: kubectl patch $kind.$api_version -n $NAMESPACE $name --type=merge -p '$patch'"
    else
        kubectl patch "$kind.$api_version" -n "$NAMESPACE" "$name" --type=merge -p "$patch"
        echo "  ✓ Patched successfully"
    fi
}

# Main cleanup function
cleanup_dashboards() {
    local total=0
    local with_boms=0
    local cleaned=0

    echo "Scanning dashboards..."
    echo ""

    # Check v0alpha1 dashboards
    echo "Checking v0alpha1 dashboards..."
    v0_dashboards=$(get_dashboards "dashboard.grafana.app/v0alpha1" "dashboard" 2>/dev/null || echo '{"items":[]}')
    v0_count=$(echo "$v0_dashboards" | jq '.items | length')
    echo "  Found $v0_count v0alpha1 dashboards"

    for name in $(echo "$v0_dashboards" | jq -r '.items[].metadata.name'); do
        total=$((total + 1))
        dashboard=$(echo "$v0_dashboards" | jq -r ".items[] | select(.metadata.name==\"$name\")")

        if contains_bom "$dashboard"; then
            with_boms=$((with_boms + 1))
            echo "  ⚠ BOM detected in: $name"
            patch_dashboard "$name" "dashboard.grafana.app/v0alpha1" "dashboard"
            cleaned=$((cleaned + 1))
        fi
    done

    # Check v1beta1 dashboards
    echo ""
    echo "Checking v1beta1 dashboards..."
    v1_dashboards=$(get_dashboards "dashboard.grafana.app/v1beta1" "dashboard" 2>/dev/null || echo '{"items":[]}')
    v1_count=$(echo "$v1_dashboards" | jq '.items | length')
    echo "  Found $v1_count v1beta1 dashboards"

    for name in $(echo "$v1_dashboards" | jq -r '.items[].metadata.name'); do
        total=$((total + 1))
        dashboard=$(echo "$v1_dashboards" | jq -r ".items[] | select(.metadata.name==\"$name\")")

        if contains_bom "$dashboard"; then
            with_boms=$((with_boms + 1))
            echo "  ⚠ BOM detected in: $name"
            patch_dashboard "$name" "dashboard.grafana.app/v1beta1" "dashboard"
            cleaned=$((cleaned + 1))
        fi
    done

    # Check v2alpha1 dashboards
    echo ""
    echo "Checking v2alpha1 dashboards..."
    v2alpha1_dashboards=$(get_dashboards "dashboard.grafana.app/v2alpha1" "dashboard" 2>/dev/null || echo '{"items":[]}')
    v2alpha1_count=$(echo "$v2alpha1_dashboards" | jq '.items | length')
    echo "  Found $v2alpha1_count v2alpha1 dashboards"

    for name in $(echo "$v2alpha1_dashboards" | jq -r '.items[].metadata.name'); do
        total=$((total + 1))
        dashboard=$(echo "$v2alpha1_dashboards" | jq -r ".items[] | select(.metadata.name==\"$name\")")

        if contains_bom "$dashboard"; then
            with_boms=$((with_boms + 1))
            echo "  ⚠ BOM detected in: $name"
            patch_dashboard "$name" "dashboard.grafana.app/v2alpha1" "dashboard"
            cleaned=$((cleaned + 1))
        fi
    done

    # Check v2beta1 dashboards
    echo ""
    echo "Checking v2beta1 dashboards..."
    v2beta1_dashboards=$(get_dashboards "dashboard.grafana.app/v2beta1" "dashboard" 2>/dev/null || echo '{"items":[]}')
    v2beta1_count=$(echo "$v2beta1_dashboards" | jq '.items | length')
    echo "  Found $v2beta1_count v2beta1 dashboards"

    for name in $(echo "$v2beta1_dashboards" | jq -r '.items[].metadata.name'); do
        total=$((total + 1))
        dashboard=$(echo "$v2beta1_dashboards" | jq -r ".items[] | select(.metadata.name==\"$name\")")

        if contains_bom "$dashboard"; then
            with_boms=$((with_boms + 1))
            echo "  ⚠ BOM detected in: $name"
            patch_dashboard "$name" "dashboard.grafana.app/v2beta1" "dashboard"
            cleaned=$((cleaned + 1))
        fi
    done

    # Summary
    echo ""
    echo "==================================="
    echo "Summary"
    echo "==================================="
    echo "Total dashboards scanned: $total"
    echo "Dashboards with BOMs: $with_boms"
    if [ "$DRY_RUN" = "true" ]; then
        echo "Would clean: $cleaned (DRY RUN)"
    else
        echo "Cleaned: $cleaned"
    fi
    echo ""

    if [ "$with_boms" -eq 0 ]; then
        echo "✓ No dashboards with BOMs found!"
    elif [ "$DRY_RUN" = "true" ]; then
        echo "ℹ This was a dry run. Set DRY_RUN=false to actually clean dashboards."
    else
        echo "✓ Cleanup complete!"
    fi
}

# Main execution
check_kubectl
cleanup_dashboards

exit 0
