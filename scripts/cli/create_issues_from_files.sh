#!/bin/bash

# Script to create GitHub issues from text files in a directory
# Usage: ./create_issues_from_files.sh <directory> <owner/repo>

# FYI: Generated almost entirely with warp.dev as a quick hack for creating issues from betterer issues output

set -e

# Function to display usage
usage() {
    echo "Usage: $0 <directory> <owner/repo>"
    echo ""
    echo "Arguments:"
    echo "  directory   Directory containing text files"
    echo "  owner/repo  GitHub repository in format 'owner/repository'"
    echo ""
    echo "Examples:"
    echo "  $0 ./issues myuser/myrepo"
    echo "  $0 /path/to/issues organization/project"
    exit 1
}

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    echo "Error: Incorrect number of arguments"
    usage
fi

DIRECTORY="$1"
REPO="$2"

# Validate directory exists
if [ ! -d "$DIRECTORY" ]; then
    echo "Error: Directory '$DIRECTORY' does not exist"
    exit 1
fi

# Validate repository format
if [[ ! "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
    echo "Error: Repository must be in format 'owner/repository'"
    exit 1
fi

echo "Creating issues from text files in '$DIRECTORY' for repository '$REPO'"
echo

# Counter for created issues
created_count=0
error_count=0

# Process each text file in the directory
for file in "$DIRECTORY"/*.txt; do
    # Check if glob matched any files
    [ -e "$file" ] || continue

    filename=$(basename "$file")
    filename_no_ext="${filename%.*}"

    echo "Processing: $filename"

    # Read file content
    if [ ! -r "$file" ]; then
        echo "  ❌ Error: Cannot read file '$file'"
        ((error_count++))
        continue
    fi

    content=$(cat "$file")

    # Skip empty files
    if [ -z "$content" ]; then
        echo "  ⚠️  Skipping empty file"
        continue
    fi

    # Parse codeowner from first line (assuming format like "@username" or "@team/name")
    first_line=$(echo "$content" | head -n 1)
    codeowner=""

    # Extract codeowner if first line contains @username or @team/name pattern
    if [[ "$first_line" =~ @[a-zA-Z0-9_/-]+ ]]; then
        codeowner=$(echo "$first_line" | grep -o '@[a-zA-Z0-9_/-]*' | head -n 1)
        # Strip @grafana/ prefix if present
        codeowner=${codeowner#@grafana/}
    fi

    title="Betterer: React Hooks ($codeowner)"

    # Create the issue using GitHub CLI
    if gh issue create \
        --repo "$REPO" \
        --title "$title" \
        --body "$content" > /dev/null 2>&1; then
        echo "  ✅ Created issue: $title"
        ((created_count++))
    else
        echo "  ❌ Failed to create issue: $title"
        ((error_count++))
    fi
done

echo
echo "Summary:"
echo "  Issues created: $created_count"
echo "  Errors: $error_count"

if [ $created_count -eq 0 ] && [ $error_count -eq 0 ]; then
    echo "  No .txt files found in '$DIRECTORY'"
fi
