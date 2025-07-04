#!/bin/bash

# Code Owner CLI - Find code owners for file paths
# Usage: ./get-owner.sh <repository_path> <file_path>
# Example: ./get-owner.sh . pkg/api/api.go

set -e

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <repository_path> <file_path>"
    exit 1
fi

REPO_PATH="$1"
FILE_PATH="$2"

# Path to CODEOWNERS file
CODEOWNERS_FILE="$REPO_PATH/.github/CODEOWNERS"

# Check if CODEOWNERS file exists
if [ ! -f "$CODEOWNERS_FILE" ]; then
    echo "Error: CODEOWNERS file not found at $CODEOWNERS_FILE"
    exit 1
fi

# Function to check if a file path matches a pattern
matches_pattern() {
    local pattern="$1"
    local file_path="$2"
    
    # Remove leading slash from pattern if present
    pattern="${pattern#/}"
    
    # Handle exact matches
    if [ "$pattern" = "$file_path" ]; then
        return 0
    fi
    
    # Handle directory patterns (ending with /)
    if [[ "$pattern" == */ ]]; then
        pattern="${pattern%/}"
        if [[ "$file_path" == "$pattern"* ]]; then
            return 0
        fi
    fi
    
    # Handle wildcard patterns
    if [[ "$pattern" == *\** ]]; then
        # Convert glob pattern to regex-like matching
        if [[ "$file_path" == $pattern ]]; then
            return 0
        fi
    fi
    
    # Handle prefix matching for directories
    if [[ "$file_path" == "$pattern"/* ]]; then
        return 0
    fi
    
    return 1
}

# Parse CODEOWNERS file and find the most specific match
best_match=""
best_match_owners=""
best_match_specificity=0

while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Parse line: first token is the pattern, rest are owners
    read -r pattern owners <<< "$line"
    
    # Skip if no pattern or owners
    if [[ -z "$pattern" || -z "$owners" ]]; then
        continue
    fi
    
    # Check if the file matches this pattern
    if matches_pattern "$pattern" "$FILE_PATH"; then
        # Calculate specificity (longer patterns are more specific)
        specificity=${#pattern}
        
        # If this is more specific than our current best match, use it
        if [ $specificity -gt $best_match_specificity ]; then
            best_match="$pattern"
            best_match_owners="$owners"
            best_match_specificity=$specificity
        fi
    fi
done < "$CODEOWNERS_FILE"

# Output the result
if [[ -n "$best_match_owners" ]]; then
    echo "Code owner for $FILE_PATH: $best_match_owners"
    exit 0
else
    echo "No code owner found for $FILE_PATH"
    exit 1
fi 